import json
import os
import re
import urllib.error
import urllib.request
from datetime import datetime

try:
    from .empathy import analyze_empathy, extract_customer_emotion
    from .scoring import count_interruptions, estimate_repeated_issue_count, score_call
    from .sentiment import analyze_customer_sentiment_agent
except ImportError:
    from empathy import analyze_empathy, extract_customer_emotion
    from scoring import count_interruptions, estimate_repeated_issue_count, score_call
    from sentiment import analyze_customer_sentiment_agent

CUSTOMER_REQUEST_PATTERNS = {
    "Plan upgrade/change": ("change my plan", "upgrade", "downgrade", "broadband plan", "plan"),
    "Internet troubleshooting": ("internet", "not working", "slow", "connect", "connectivity", "wifi", "broadband"),
    "Billing support": ("bill", "payment", "charge", "invoice", "refund"),
    "Device/service repair": ("laptop", "repair", "warranty", "overheating", "service"),
    "Account support": ("account", "login", "password", "registered number"),
}

AGENT_RESPONSE_PATTERNS = {
    "Plan upgrade/change": ("plan", "upgrade", "downgrade", "package"),
    "Internet troubleshooting": ("restart", "router", "internet", "wifi", "network", "troubleshoot"),
    "Billing support": ("bill", "payment", "charge", "invoice", "refund"),
    "Device/service repair": ("engineer", "repair", "warranty", "service", "ticket"),
    "Account support": ("account", "login", "password", "registered number"),
}

CONFIRMATION_PHRASES = (
    "can you confirm",
    "please confirm",
    "is it working",
    "has this resolved",
    "are you satisfied",
    "anything else",
    "does that solve",
)

HESITATION_PHRASES = (
    "okay i'll try",
    "okay... i'll try",
    "i will try",
    "not sure",
    "maybe",
    "i guess",
    "still",
    "let me see",
)


def generate_coaching_notes(text):
    evaluation = evaluate_call({"transcript": text or "", "segments": []})
    return evaluation["coachingReport"]["tips"]


def evaluate_call(call_payload):
    """Build the complete call intelligence JSON used by dashboards."""
    segments = call_payload.get("segments") or []
    transcript = call_payload.get("transcript") or _segments_to_text(segments)
    original_segments = call_payload.get("originalSegments") or segments

    local_evaluation = _build_local_evaluation(transcript, original_segments, call_payload)
    llm_evaluation = _evaluate_with_groq(transcript, original_segments, local_evaluation)

    if llm_evaluation:
        return _merge_llm_evaluation(local_evaluation, llm_evaluation)

    return local_evaluation


def _build_local_evaluation(transcript, segments, call_payload):
    empathy = analyze_empathy(_agent_text(segments, transcript))
    base_score = score_call(transcript)
    customer_text = _customer_text(segments, transcript)
    agent_text = _agent_text(segments, transcript)
    customer_request = _detect_intent(customer_text, CUSTOMER_REQUEST_PATTERNS)
    agent_response = _detect_intent(agent_text, AGENT_RESPONSE_PATTERNS)
    miscommunication = _detect_miscommunication(customer_request, agent_response, transcript)
    resolution = _analyze_resolution(transcript, base_score["signals"])
    repeated_issue_count = estimate_repeated_issue_count(customer_text)
    confirmation_detected = _contains_any(transcript.lower(), CONFIRMATION_PHRASES)
    sentiment = analyze_customer_sentiment_agent(
        customer_text,
        segments,
        {
            "resolutionStatus": resolution["status"],
            "miscommunicationDetected": miscommunication["detected"],
            "repeatedIssueCount": repeated_issue_count,
            "confirmationDetected": confirmation_detected,
        },
    )
    satisfaction = _predict_satisfaction(transcript, sentiment, empathy, base_score, miscommunication, resolution)
    skill_gaps = _build_skill_gaps(transcript, empathy, base_score, miscommunication, resolution)
    strengths = _build_strengths(transcript, base_score, empathy)
    weaknesses = _build_weaknesses(transcript, base_score, empathy, miscommunication, resolution)
    priority_gap = min(skill_gaps, key=lambda item: item["score"]) if skill_gaps else None
    duration = float(call_payload.get("duration") or _estimate_duration(segments) or 0)

    return {
        "generatedAt": datetime.utcnow().isoformat() + "Z",
        "analysisSource": "local",
        "predictedSatisfaction": {
            "score": satisfaction["score"],
            "label": satisfaction["label"],
            "reason": satisfaction["reasons"],
            "followUpRecommended": satisfaction["followUpRecommended"],
        },
        "miscommunication": miscommunication,
        "resolutionAnalysis": resolution,
        "coachingReport": {
            "summary": _coaching_summary(strengths, weaknesses),
            "strengths": strengths,
            "weaknesses": weaknesses,
            "tips": _coaching_tips(weaknesses, miscommunication, resolution),
        },
        "skillGapAnalysis": {
            "skills": skill_gaps,
            "biggestSkillGap": priority_gap["name"] if priority_gap else "None",
            "priority": _priority_for_gap(priority_gap["score"] if priority_gap else 100),
        },
        "recommendedLearning": _recommended_learning(priority_gap, miscommunication, resolution),
        "completedLearning": [],
        "callSummary": {
            "customerIssue": _customer_issue_label(customer_request, transcript),
            "resolutionStatus": resolution["status"],
            "customerEmotion": sentiment.get("emotion") or extract_customer_emotion(segments),
            "agentCommunication": _agent_communication_label(base_score, empathy),
            "miscommunication": miscommunication["summary"],
            "strengths": strengths,
            "weaknesses": weaknesses,
            "coachingTips": _coaching_tips(weaknesses, miscommunication, resolution),
            "recommendedTraining": _recommended_learning(priority_gap, miscommunication, resolution)[0],
            "predictedCustomerSatisfaction": satisfaction["score"],
        },
        "metrics": {
            "overallScore": base_score["score"],
            "sentiment": sentiment,
            "empathy": empathy,
            "durationSeconds": duration,
            "talkTurns": len(segments),
            "interruptionCount": count_interruptions(transcript),
            "customerRepeatedIssueCount": repeated_issue_count,
            "confirmationDetected": confirmation_detected,
        },
    }


def _evaluate_with_groq(transcript, segments, local_evaluation):
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key or os.getenv("ENABLE_GROQ_EVALUATION", "true").lower() not in {"1", "true", "yes"}:
        return None

    model = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
    messages = [
        {
            "role": "system",
            "content": (
                "You are a call center quality analyst. Return strict JSON only. "
                "Use concise, business-friendly language. Scores must be integers from 0 to 100."
            ),
        },
        {
            "role": "user",
            "content": json.dumps(
                {
                    "task": "Refine this call evaluation JSON using the transcript. Preserve the same top-level shape.",
                    "requiredTopLevelKeys": [
                        "predictedSatisfaction",
                        "miscommunication",
                        "resolutionAnalysis",
                        "coachingReport",
                        "skillGapAnalysis",
                        "recommendedLearning",
                        "callSummary",
                        "metrics",
                    ],
                    "transcript": transcript[:12000],
                    "segments": segments[:80],
                    "localEvaluation": local_evaluation,
                },
                ensure_ascii=True,
            ),
        },
    ]
    body = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }
    request = urllib.request.Request(
        "https://api.groq.com/openai/v1/chat/completions",
        data=json.dumps(body).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(request, timeout=35) as response:
            payload = json.loads(response.read().decode("utf-8"))
        content = payload["choices"][0]["message"]["content"]
        return json.loads(content)
    except (KeyError, ValueError, urllib.error.URLError, TimeoutError):
        return None


def _merge_llm_evaluation(local_evaluation, llm_evaluation):
    merged = {**local_evaluation}

    for key in (
        "predictedSatisfaction",
        "miscommunication",
        "resolutionAnalysis",
        "coachingReport",
        "skillGapAnalysis",
        "recommendedLearning",
        "completedLearning",
        "callSummary",
        "metrics",
    ):
        if isinstance(llm_evaluation.get(key), dict) and isinstance(merged.get(key), dict):
            merged[key] = {**merged[key], **llm_evaluation[key]}
        elif key in llm_evaluation:
            merged[key] = llm_evaluation[key]

    merged["analysisSource"] = "groq"
    merged["generatedAt"] = datetime.utcnow().isoformat() + "Z"
    return merged


def _detect_miscommunication(customer_request, agent_response, transcript):
    detected = bool(customer_request and agent_response and customer_request != agent_response)

    if not detected and estimate_repeated_issue_count(transcript) >= 2:
        detected = True

    if detected:
        summary = (
            f"Customer requested {customer_request or 'a specific issue'}, "
            f"but the agent responded about {agent_response or 'a different topic'}."
        )
        recommendation = "Clarify the customer's request before offering solutions."
    else:
        summary = "No major miscommunication detected."
        recommendation = "Continue summarizing the request before moving to resolution."

    return {
        "detected": detected,
        "customerRequested": customer_request or "General support",
        "agentRespondedAbout": agent_response or "General support",
        "summary": summary,
        "recommendation": recommendation,
    }


def _analyze_resolution(transcript, signals):
    normalized = transcript.lower()
    attempted = signals.get("resolutionAttempted") or _contains_any(
        normalized,
        ("try", "ticket", "restart", "engineer", "fixed", "resolved", "solution"),
    )
    confirmed = signals.get("confirmedResolution") or _contains_any(normalized, CONFIRMATION_PHRASES)
    unresolved_markers = _contains_any(
        normalized,
        ("still not", "not fixed", "not resolved", "i will try", "not sure", "maybe"),
    )

    if attempted and confirmed and not unresolved_markers:
        status = "Resolved"
        reason = [
            "Agent provided a solution.",
            "Customer resolution confirmation was requested.",
            "No strong unresolved signal was detected.",
        ]
        follow_up = "No immediate follow-up required."
    elif attempted:
        status = "Partially resolved"
        reason = [
            "Agent provided a solution or next step.",
            "Customer never clearly confirmed the issue was fixed.",
            "Follow-up can prevent repeat contact.",
        ]
        follow_up = "Check back with the customer and confirm the outcome."
    else:
        status = "Unresolved"
        reason = [
            "No clear resolution step was detected.",
            "Customer issue may still be open.",
            "Escalation or a clearer action plan is needed.",
        ]
        follow_up = "Assign a follow-up owner and share the next action with the customer."

    return {
        "status": status,
        "reason": reason,
        "recommendedFollowUp": follow_up,
    }


def _predict_satisfaction(transcript, sentiment, empathy, base_score, miscommunication, resolution):
    score = base_score["score"]
    score += 8 if sentiment.get("label") == "positive" else 0
    score -= 10 if sentiment.get("label") == "negative" else 0
    score += round((empathy.get("score", 55) - 55) * 0.25)
    score -= 12 if miscommunication.get("detected") else 0
    score += 8 if resolution.get("status") == "Resolved" else -8
    score -= 12 if _contains_any(transcript.lower(), HESITATION_PHRASES) else 0
    score = max(0, min(100, int(round(score))))

    reasons = []
    if _contains_any(transcript.lower(), HESITATION_PHRASES):
        reasons.append("Customer sounded uncertain or hesitant.")
    if resolution.get("status") != "Resolved":
        reasons.append("Issue may not have been fully resolved.")
    if not base_score["signals"].get("confirmedResolution"):
        reasons.append("No final confirmation from the customer was detected.")
    if miscommunication.get("detected"):
        reasons.append("A possible request/response mismatch was detected.")
    if not reasons:
        reasons.append("The call contained positive resolution and confirmation signals.")

    if score >= 80:
        label = "High"
    elif score >= 60:
        label = "Moderate"
    else:
        label = "Low"

    return {
        "score": score,
        "label": label,
        "reasons": reasons,
        "followUpRecommended": score < 75 or resolution.get("status") != "Resolved",
    }


def _build_skill_gaps(transcript, empathy, base_score, miscommunication, resolution):
    signals = base_score["signals"]
    communication = 72
    communication += 10 if signals.get("issueAcknowledged") else -12
    communication -= 10 if miscommunication.get("detected") else 0
    communication -= min(count_interruptions(transcript) * 6, 18)

    problem_solving = 70
    problem_solving += 12 if signals.get("resolutionAttempted") else -18
    problem_solving += 8 if resolution.get("status") == "Resolved" else -8

    listening = 74
    listening += 8 if signals.get("issueAcknowledged") else -16
    listening -= min(max(signals.get("repeatedIssueCount", 0) - 1, 0) * 10, 22)
    listening -= 12 if miscommunication.get("detected") else 0

    return [
        {"name": "Communication", "score": _bounded(communication)},
        {"name": "Empathy", "score": _bounded(empathy.get("score", 55))},
        {"name": "Problem Solving", "score": _bounded(problem_solving)},
        {"name": "Listening", "score": _bounded(listening)},
    ]


def _build_strengths(transcript, base_score, empathy):
    normalized = transcript.lower()
    strengths = []

    if _contains_any(normalized, ("hello", "thank you", "thanks", "welcome")):
        strengths.append("Polite greeting and professional language")
    if base_score["signals"].get("resolutionAttempted"):
        strengths.append("Provided a solution or next step")
    if empathy.get("score", 0) >= 70:
        strengths.append("Showed empathy toward the customer")
    if _contains_any(normalized, ("ticket", "warranty", "plan", "router", "account")):
        strengths.append("Good product or process knowledge")

    return strengths[:4] or ["Maintained a professional tone"]


def _build_weaknesses(transcript, base_score, empathy, miscommunication, resolution):
    weaknesses = []
    signals = base_score["signals"]
    interruptions = count_interruptions(transcript)

    if interruptions:
        weaknesses.append(f"Interrupted or spoke over the customer {interruptions} time(s)")
    if not signals.get("issueAcknowledged"):
        weaknesses.append("Did not clearly confirm the customer's issue")
    if miscommunication.get("detected"):
        weaknesses.append("Responded to a different topic than the customer requested")
    if empathy.get("score", 0) < 65:
        weaknesses.append("Missed opportunities to reassure the customer")
    if resolution.get("status") != "Resolved":
        weaknesses.append("Did not confirm final resolution")

    return weaknesses[:5] or ["No major weakness detected"]


def _coaching_tips(weaknesses, miscommunication, resolution):
    tips = [
        "Use active listening.",
        "Summarize the customer's problem before proposing a solution.",
        "End every call by confirming customer satisfaction.",
    ]

    if miscommunication.get("detected"):
        tips.insert(1, "Ask one clarifying question when the request and response do not match.")

    if resolution.get("status") != "Resolved":
        tips.append("Create a clear follow-up action with owner and timeline.")

    return tips[:5]


def _recommended_learning(priority_gap, miscommunication, resolution):
    if miscommunication.get("detected") or (priority_gap and priority_gap["name"] == "Listening"):
        return ["Active listening and request confirmation (20 minutes)"]

    if resolution.get("status") != "Resolved":
        return ["Resolution ownership and follow-up handling (25 minutes)"]

    if priority_gap and priority_gap["name"] == "Empathy":
        return ["Handling frustrated customers with empathy (20 minutes)"]

    return ["Advanced call closure and satisfaction confirmation (15 minutes)"]


def _coaching_summary(strengths, weaknesses):
    return (
        f"You handled the call with {strengths[0].lower()}. "
        f"Focus next on {weaknesses[0].lower()}."
    )


def _agent_communication_label(base_score, empathy):
    if base_score["score"] >= 78 and empathy.get("score", 0) >= 70:
        return "Professional, clear, and supportive."
    if base_score["signals"].get("issueAcknowledged"):
        return "Professional but needs stronger closure."
    return "Professional but delayed issue confirmation."


def _customer_issue_label(customer_request, transcript):
    if customer_request and customer_request != "General support":
        return customer_request

    normalized = transcript.lower()
    if "internet" in normalized or "connectivity" in normalized:
        return "Internet connectivity problem"
    if "plan" in normalized:
        return "Plan change request"
    if "bill" in normalized:
        return "Billing concern"
    return "Customer support request"


def _priority_for_gap(score):
    if score < 60:
        return "High"
    if score < 75:
        return "Medium"
    return "Low"


def _detect_intent(text, patterns):
    normalized = text.lower()
    matches = []

    for label, phrases in patterns.items():
        score = sum(1 for phrase in phrases if phrase in normalized)
        if score:
            matches.append((score, label))

    if not matches:
        return None

    matches.sort(reverse=True)
    return matches[0][1]


def _customer_text(segments, fallback):
    text = " ".join(
        segment.get("text", "")
        for segment in segments or []
        if _speaker_role(segment.get("speaker")) == "customer"
    ).strip()
    return text or fallback


def _agent_text(segments, fallback):
    text = " ".join(
        segment.get("text", "")
        for segment in segments or []
        if _speaker_role(segment.get("speaker")) == "agent"
    ).strip()
    return text or fallback


def _speaker_role(speaker):
    speaker = str(speaker or "").lower()
    if "2" in speaker or "customer" in speaker:
        return "customer"
    return "agent"


def _segments_to_text(segments):
    return " ".join(segment.get("text", "") for segment in segments or []).strip()


def _contains_any(text, phrases):
    return any(phrase in text for phrase in phrases)


def _bounded(value):
    return max(0, min(100, int(round(value))))


def _estimate_duration(segments):
    if not segments:
        return 0

    return max(float(segment.get("end") or 0) for segment in segments)
