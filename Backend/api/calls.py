from collections import Counter, defaultdict
from datetime import datetime, timedelta

from bson import ObjectId
from fastapi import APIRouter, HTTPException, Query, Request
from pydantic import BaseModel, Field

try:
    from ..analysis.coaching import evaluate_call
    from ..database.mongo import calls_collection, users_collection
except ImportError:
    from analysis.coaching import evaluate_call
    from database.mongo import calls_collection, users_collection

router = APIRouter(prefix="/api", tags=["calls"])


def request_user(request: Request):
    employee_id = (request.headers.get("X-User-Employee-Id") or "").strip()
    role = (request.headers.get("X-User-Role") or "").strip()

    if not employee_id or role not in {"Manager", "Employee"}:
        raise HTTPException(status_code=401, detail="User identity is required.")

    user = users_collection.find_one({"employeeId": employee_id}, {"passwordHash": 0})

    if not user or user.get("role") != role:
        raise HTTPException(status_code=403, detail="User role could not be verified.")

    return user


def employee_team_ids(manager_id=None):
    query = {"role": "Employee"}

    if manager_id:
        query["$or"] = [
            {"managerId": manager_id},
            {"managerId": {"$exists": False}},
            {"managerId": ""},
            {"managerId": None},
        ]

    return [
        user["employeeId"]
        for user in users_collection.find(query, {"employeeId": 1})
        if user.get("employeeId")
    ]


class SegmentPayload(BaseModel):
    id: int | None = None
    start: float | None = None
    end: float | None = None
    speaker: str | None = None
    text: str


class EvaluationRequest(BaseModel):
    transcript: str = ""
    segments: list[SegmentPayload] = Field(default_factory=list)
    originalSegments: list[SegmentPayload] = Field(default_factory=list)
    duration: float | None = None


@router.post("/evaluation/analyze")
def analyze_structured_conversation(payload: EvaluationRequest):
    return {
        "ok": True,
        "evaluation": evaluate_call(
            {
                "transcript": payload.transcript,
                "segments": [dump_model(segment) for segment in payload.segments],
                "originalSegments": [dump_model(segment) for segment in payload.originalSegments],
                "duration": payload.duration,
            }
        ),
    }


@router.get("/calls")
def list_calls(
    request: Request,
    employeeId: str | None = Query(default=None),
    role: str | None = Query(default=None),
    limit: int = Query(default=30, ge=1, le=100),
):
    user = request_user(request)
    query = {}

    if user["role"] == "Manager":
        team_ids = employee_team_ids(user["employeeId"])
        if employeeId:
            if employeeId not in team_ids:
                raise HTTPException(status_code=403, detail="Managers can only access employee team calls.")
            query["employeeId"] = employeeId
        else:
            query["employeeId"] = {"$in": team_ids}
    else:
        if employeeId and employeeId != user["employeeId"]:
            raise HTTPException(status_code=403, detail="Employees can only access their own calls.")
        query["employeeId"] = user["employeeId"]

    calls = [
        serialize_call(call, include_transcript=False)
        for call in calls_collection.find(query).sort("createdAt", -1).limit(limit)
    ]
    return {"ok": True, "calls": calls}


@router.get("/calls/{call_id}")
def get_call(call_id: str, request: Request):
    user = request_user(request)

    try:
        object_id = ObjectId(call_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid call id.")

    call = calls_collection.find_one({"_id": object_id})

    if not call:
        raise HTTPException(status_code=404, detail="Call not found.")

    if user["role"] == "Manager":
        if call.get("employeeId") not in employee_team_ids(user["employeeId"]):
            raise HTTPException(status_code=403, detail="Managers can only access employee team calls.")
    elif call.get("employeeId") != user["employeeId"]:
        raise HTTPException(status_code=403, detail="Employees can only access their own calls.")

    return {"ok": True, "call": serialize_call(call, include_transcript=True)}


@router.get("/dashboard/manager")
def manager_dashboard(request: Request):
    user = request_user(request)

    if user["role"] != "Manager":
        raise HTTPException(status_code=403, detail="Manager dashboard is restricted to managers.")

    team_ids = employee_team_ids(user["employeeId"])
    calls = list(calls_collection.find({"employeeId": {"$in": team_ids}}).sort("createdAt", -1).limit(500))
    users = list(users_collection.find({"$or": [{"employeeId": {"$in": team_ids}}, {"employeeId": user["employeeId"]}]}, {"passwordHash": 0}))
    return {
        "ok": True,
        "dashboard": build_manager_dashboard(calls, users),
        "calls": [serialize_call(call, include_transcript=False) for call in calls[:100]],
    }


@router.get("/leaderboard")
def shared_leaderboard(request: Request):
    user = request_user(request)
    team_ids = employee_team_ids(user["employeeId"]) if user["role"] == "Manager" else employee_team_ids()
    calls = list(calls_collection.find({"employeeId": {"$in": team_ids}}).sort("createdAt", -1).limit(500))
    users = list(users_collection.find({"role": "Employee"}, {"passwordHash": 0}))
    return {"ok": True, "leaderboard": build_leaderboard(calls, users)}


@router.get("/dashboard/employee/{employee_id}")
def employee_dashboard(employee_id: str, request: Request):
    user = request_user(request)

    if user["role"] == "Employee" and employee_id != user["employeeId"]:
        raise HTTPException(status_code=403, detail="Employees can only access their own dashboard.")

    if user["role"] == "Manager" and employee_id not in employee_team_ids(user["employeeId"]):
        raise HTTPException(status_code=403, detail="Managers can only access employee team dashboards.")

    calls = list(calls_collection.find({"employeeId": employee_id}).sort("createdAt", -1).limit(200))
    user = users_collection.find_one({"employeeId": employee_id}, {"passwordHash": 0})
    return {
        "ok": True,
        "dashboard": build_employee_dashboard(calls, user),
        "calls": [serialize_call(call, include_transcript=False) for call in calls[:20]],
    }


def build_manager_dashboard(calls, users):
    employee_calls = defaultdict(list)

    for call in calls:
        employee_calls[call.get("employeeId", "Unknown")].append(call)

    employee_cards = []
    for employee_id, grouped_calls in employee_calls.items():
        user = next((item for item in users if item.get("employeeId") == employee_id), {})
        summary = summarize_calls(grouped_calls)
        strengths, weaknesses = strengths_and_weaknesses(grouped_calls)
        employee_cards.append(
            {
                "employeeId": employee_id,
                "fullName": user.get("fullName") or grouped_calls[0].get("employeeName") or "Unknown Employee",
                "role": user.get("role", "Employee"),
                "strengths": strengths,
                "weaknesses": weaknesses,
                "aiCoach": coach_message(grouped_calls),
                "recommendedLearning": top_recommendations(grouped_calls),
                "skillGaps": aggregate_skill_gaps(grouped_calls),
                "performanceTrend": trend_for_calls(grouped_calls),
                "latestCall": serialize_call(grouped_calls[0], include_transcript=False) if grouped_calls else None,
                **summary,
            }
        )

    employee_cards.sort(key=lambda item: item["overallPerformance"], reverse=True)

    return {
        "overallPerformance": average([_overall_score(call) for call in calls]),
        "todaysScore": average([_overall_score(call) for call in calls if _is_today(call)]),
        "thisWeekGrowth": growth_for_calls(calls),
        "totalCalls": len(calls),
        "leaderboard": employee_cards[:8],
        "employees": employee_cards,
        "skillGaps": aggregate_skill_gaps(calls),
        "performanceTrend": trend_for_calls(calls),
        "recentCalls": [serialize_call(call, include_transcript=False) for call in calls[:8]],
        "recommendedLearning": top_recommendations(calls),
    }


def build_leaderboard(calls, users):
    employee_calls = defaultdict(list)

    for call in calls:
        employee_calls[call.get("employeeId", "Unknown")].append(call)

    rows = []
    for employee_id, grouped_calls in employee_calls.items():
        user = next((item for item in users if item.get("employeeId") == employee_id), {})
        summary = summarize_calls(grouped_calls)
        rows.append(
            {
                "employeeId": employee_id,
                "fullName": user.get("fullName") or grouped_calls[0].get("employeeName") or "Unknown Employee",
                "overallPerformance": summary["overallPerformance"],
                "callCount": summary["callCount"],
                "lastCallAt": summary["lastCallAt"],
            }
        )

    rows.sort(key=lambda item: item["overallPerformance"], reverse=True)
    return rows


def build_employee_dashboard(calls, user):
    summary = summarize_calls(calls)
    strengths, weaknesses = strengths_and_weaknesses(calls)

    return {
        "employeeId": (user or {}).get("employeeId") or (calls[0].get("employeeId") if calls else ""),
        "fullName": (user or {}).get("fullName") or (calls[0].get("employeeName") if calls else "Employee"),
        "overallPerformance": summary["overallPerformance"],
        "todaysScore": summary["todaysScore"],
        "thisWeekGrowth": growth_for_calls(calls),
        "strengths": strengths,
        "weaknesses": weaknesses,
        "aiCoach": coach_message(calls),
        "recommendedLearning": top_recommendations(calls),
        "completedLearning": completed_learning(calls),
        "performanceTrend": trend_for_calls(calls),
        "skillGaps": aggregate_skill_gaps(calls),
        "latestCall": serialize_call(calls[0], include_transcript=False) if calls else None,
        "totalCalls": len(calls),
    }


def summarize_calls(calls):
    return {
        "overallPerformance": average([_overall_score(call) for call in calls]),
        "todaysScore": average([_overall_score(call) for call in calls if _is_today(call)]),
        "averageSatisfaction": average([_satisfaction_score(call) for call in calls]),
        "callCount": len(calls),
        "lastCallAt": _iso(calls[0].get("createdAt")) if calls else None,
    }


def serialize_call(call, include_transcript):
    evaluation = call.get("evaluation") or {}
    summary = evaluation.get("callSummary") or {}
    item = {
        "id": str(call.get("_id")),
        "filename": call.get("filename"),
        "employeeId": call.get("employeeId"),
        "employeeName": call.get("employeeName"),
        "createdAt": _iso(call.get("createdAt")),
        "duration": call.get("duration", 0),
        "language": call.get("language"),
        "outputLanguage": call.get("outputLanguage"),
        "storedFilename": call.get("storedFilename"),
        "transcriptFile": call.get("transcriptFile"),
        "summary": {
            "customerIssue": summary.get("customerIssue", "Customer support request"),
            "resolutionStatus": summary.get("resolutionStatus", "Not evaluated"),
            "customerEmotion": summary.get("customerEmotion", "Neutral"),
            "predictedCustomerSatisfaction": summary.get(
                "predictedCustomerSatisfaction",
                _satisfaction_score(call),
            ),
        },
        "evaluation": evaluation,
    }

    if include_transcript:
        item.update(
            {
                "transcript": call.get("transcript", ""),
                "displayTranscript": call.get("displayTranscript", ""),
                "segments": call.get("segments", []),
                "originalSegments": call.get("originalSegments", []),
            }
        )

    return item


def aggregate_skill_gaps(calls):
    skill_scores = defaultdict(list)

    for call in calls:
        for skill in ((call.get("evaluation") or {}).get("skillGapAnalysis") or {}).get("skills", []):
            skill_scores[skill.get("name", "Skill")].append(float(skill.get("score", 0)))

    return [
        {"name": name, "score": average(scores)}
        for name, scores in sorted(skill_scores.items(), key=lambda item: average(item[1]))
    ]


def trend_for_calls(calls):
    buckets = defaultdict(list)

    for call in calls:
        created_at = _as_datetime(call.get("createdAt"))
        label = created_at.strftime("%d %b")
        buckets[label].append(_overall_score(call))

    return [
        {"label": label, "score": average(scores)}
        for label, scores in list(sorted(buckets.items(), key=lambda item: item[0]))[-7:]
    ]


def growth_for_calls(calls):
    now = datetime.utcnow()
    current_week = [
        _overall_score(call)
        for call in calls
        if _as_datetime(call.get("createdAt")) >= now - timedelta(days=7)
    ]
    previous_week = [
        _overall_score(call)
        for call in calls
        if now - timedelta(days=14) <= _as_datetime(call.get("createdAt")) < now - timedelta(days=7)
    ]

    if not current_week:
        return 0

    return average(current_week) - average(previous_week)


def strengths_and_weaknesses(calls):
    strengths = Counter()
    weaknesses = Counter()

    for call in calls:
        coaching = (call.get("evaluation") or {}).get("coachingReport") or {}
        strengths.update(coaching.get("strengths") or [])
        weaknesses.update(coaching.get("weaknesses") or [])

    return (
        [item for item, _ in strengths.most_common(4)] or ["No strengths recorded yet"],
        [item for item, _ in weaknesses.most_common(4)] or ["No weaknesses recorded yet"],
    )


def top_recommendations(calls):
    recommendations = Counter()

    for call in calls:
        recommendations.update((call.get("evaluation") or {}).get("recommendedLearning") or [])

    return [item for item, _ in recommendations.most_common(4)] or [
        "Upload evaluated calls to generate learning recommendations"
    ]


def completed_learning(calls):
    completed = []

    for call in calls:
        completed.extend((call.get("evaluation") or {}).get("completedLearning") or [])

    return completed[:6]


def coach_message(calls):
    if not calls:
        return "Upload calls to generate personalized AI coaching."

    latest = (calls[0].get("evaluation") or {}).get("coachingReport") or {}
    return latest.get("summary") or "Keep confirming the customer's issue before giving a solution."


def _overall_score(call):
    return int((((call.get("evaluation") or {}).get("metrics") or {}).get("overallScore") or 0))


def _satisfaction_score(call):
    return int((((call.get("evaluation") or {}).get("predictedSatisfaction") or {}).get("score") or 0))


def _is_today(call):
    return _as_datetime(call.get("createdAt")).date() == datetime.utcnow().date()


def _as_datetime(value):
    if isinstance(value, datetime):
        return value

    if isinstance(value, str):
        try:
            return datetime.fromisoformat(value.replace("Z", "+00:00")).replace(tzinfo=None)
        except ValueError:
            return datetime.utcnow()

    return datetime.utcnow()


def _iso(value):
    if isinstance(value, datetime):
        return value.isoformat() + "Z"
    return value


def average(values):
    values = [float(value) for value in values if value is not None]

    if not values:
        return 0

    return int(round(sum(values) / len(values)))


def dump_model(model):
    if hasattr(model, "model_dump"):
        return model.model_dump()

    return model.dict()
