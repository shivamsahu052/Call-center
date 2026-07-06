import os
import random
import re
import secrets
import smtplib
import ssl
from datetime import datetime, timedelta
from email.message import EmailMessage
from pathlib import Path
from typing import Optional
from urllib.parse import quote

from dotenv import load_dotenv
from bson import ObjectId
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, constr
from pymongo.errors import DuplicateKeyError

try:
    from .api.calls import router as calls_router
    from .api.transcription import router as transcription_router
    from .database.mongo import (
        employee_approvals_collection,
        ensure_indexes,
        inbox_collection,
        pending_collection,
        password_resets,
        users_collection,
    )
except ImportError:
    from api.calls import router as calls_router
    from api.transcription import router as transcription_router
    from database.mongo import ensure_indexes, inbox_collection, pending_collection, password_resets, users_collection
    from database.mongo import employee_approvals_collection

load_dotenv(Path(__file__).with_name('.env'))

PRIMARY_MANAGER_EMAIL = os.getenv('PRIMARY_MANAGER_EMAIL', 'nishantshivmishra1983@gmail.com')
APP_BASE_URL = os.getenv('APP_BASE_URL', 'http://127.0.0.1:8000')
SMTP_HOST = os.getenv('SMTP_HOST')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
SMTP_FROM = os.getenv('SMTP_FROM', 'Call Center <noreply@example.com>')
SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'true').lower() in ('1', 'true', 'yes')

ensure_indexes()

pwd_context = CryptContext(schemes=['pbkdf2_sha256'], deprecated='auto')
password_pattern = re.compile(r'^(?=.{8,}$)(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).*$')

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)
app.include_router(transcription_router)
app.include_router(calls_router)


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            'detail': exc.detail,
        },
    )


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=500,
        content={
            'detail': 'Internal Server Error',
            'error': str(exc),
            'type': type(exc).__name__,
        },
    )


def normalize_email(email: str) -> str:
    return email.strip().lower()


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    return pwd_context.verify(password, hashed)


def validate_password(password: str) -> None:
    if not password_pattern.match(password):
        raise HTTPException(
            status_code=400,
            detail=(
                'Password must be at least 8 characters and include uppercase, lowercase, ' \
                'a number, and a special character.'
            ),
        )


def iso_date(value):
    if isinstance(value, datetime):
        return value.isoformat() + 'Z'
    return value


def normalize_manager_code(code: str | None) -> str:
    return (code or '').strip().upper()


def request_user(request: Request):
    employee_id = (request.headers.get('X-User-Employee-Id') or '').strip()
    role = (request.headers.get('X-User-Role') or '').strip()

    if not employee_id or role not in {'Manager', 'Employee'}:
        raise HTTPException(status_code=401, detail='User identity is required.')

    user = users_collection.find_one({'employeeId': employee_id}, {'passwordHash': 0})

    if not user or user.get('role') != role:
        raise HTTPException(status_code=403, detail='User role could not be verified.')

    return ensure_manager_code(user)


def create_employee_id(role: str) -> str:
    prefix = 'MGR' if role == 'Manager' else 'EMP'
    while True:
        employee_id = f'{prefix}-{random.randint(100000, 999999)}'
        if (
            not users_collection.find_one({'employeeId': employee_id})
            and not pending_collection.find_one({'employeeId': employee_id})
            and not employee_approvals_collection.find_one({'employeeId': employee_id})
        ):
            return employee_id


def create_manager_code() -> str:
    while True:
        code = f"MGR-{secrets.token_hex(3).upper()}"
        if not users_collection.find_one({'managerCode': code}):
            return code


def ensure_manager_code(user: dict) -> dict:
    if user.get('role') != 'Manager' or user.get('managerCode'):
        return user

    manager_code = create_manager_code()
    users_collection.update_one({'_id': user['_id']}, {'$set': {'managerCode': manager_code}})
    user['managerCode'] = manager_code
    return user


def manager_by_code(manager_code: str):
    code = normalize_manager_code(manager_code)

    if not code:
        return None

    return users_collection.find_one({'role': 'Manager', 'managerCode': code}, {'passwordHash': 0})


def serialize_inbox_message(message: dict) -> dict:
    item = {
        'id': str(message.get('_id')),
        'type': message.get('type', 'notification'),
        'title': message.get('title', ''),
        'body': message.get('body', ''),
        'status': message.get('status', 'unread'),
        'createdAt': iso_date(message.get('createdAt')),
        'readAt': iso_date(message.get('readAt')),
        'approvalId': message.get('approvalId'),
        'approvalStatus': message.get('approvalStatus'),
        'requesterName': message.get('requesterName'),
        'requesterEmail': message.get('requesterEmail'),
        'requesterRole': message.get('requesterRole'),
        'decision': message.get('decision'),
        'decisionBy': message.get('decisionBy'),
    }

    return {key: value for key, value in item.items() if value not in (None, '')}


def create_inbox_message(recipient: dict, message: dict) -> None:
    inbox_collection.insert_one(
        {
            'recipientId': recipient.get('employeeId'),
            'recipientEmail': recipient.get('email'),
            'recipientRole': recipient.get('role'),
            'recipientName': recipient.get('fullName'),
            'status': 'unread',
            'createdAt': datetime.utcnow(),
            **message,
        }
    )


def create_approval_request_messages(approval: dict) -> int:
    approval_id = str(approval['_id'])

    if approval.get('role') == 'Employee':
        manager = users_collection.find_one(
            {'employeeId': approval.get('managerId'), 'role': 'Manager'},
            {'passwordHash': 0},
        )

        if not manager:
            return 0

        create_inbox_message(
            manager,
            {
                'type': 'approval_request',
                'title': 'Employee approval request',
                'body': (
                    f"{approval.get('fullName')} requested employee access under your manager code."
                ),
                'approvalId': approval_id,
                'approvalStatus': 'pending',
                'requesterName': approval.get('fullName'),
                'requesterEmail': approval.get('email'),
                'requesterRole': approval.get('role'),
            },
        )
        return 1

    managers = list(users_collection.find({'role': 'Manager'}, {'passwordHash': 0}))

    for manager in managers:
        create_inbox_message(
            manager,
            {
                'type': 'approval_request',
                'title': 'Manager approval request',
                'body': f"{approval.get('fullName')} requested manager access.",
                'approvalId': approval_id,
                'approvalStatus': 'pending',
                'requesterName': approval.get('fullName'),
                'requesterEmail': approval.get('email'),
                'requesterRole': approval.get('role'),
            },
        )

    return len(managers)


def create_requester_status_message(approval: dict, decision: str, actor: dict | None = None) -> None:
    recipient = {
        'employeeId': approval.get('employeeId'),
        'email': approval.get('email'),
        'role': approval.get('role'),
        'fullName': approval.get('fullName'),
    }
    approved = decision == 'approved'
    role_label = str(approval.get('role', 'account')).lower()
    manager_name = approval.get('managerName') or (actor or {}).get('fullName') or 'your manager'
    title = f"{approval.get('role', 'Account')} registration {'approved' if approved else 'rejected'}"
    body = (
        f"Your {role_label} registration was approved by {manager_name}. You can now log in."
        if approved
        else f"Your {role_label} registration was rejected by {manager_name}."
    )

    create_inbox_message(
        recipient,
        {
            'type': 'notification',
            'title': title,
            'body': body,
            'approvalId': str(approval.get('_id')),
            'approvalStatus': decision,
            'decision': decision,
            'decisionBy': (actor or {}).get('fullName'),
        },
    )


def update_approval_request_messages(approval: dict, decision: str, actor: dict | None = None) -> None:
    inbox_collection.update_many(
        {'approvalId': str(approval.get('_id')), 'type': 'approval_request'},
        {
            '$set': {
                'approvalStatus': decision,
                'decision': decision,
                'decisionBy': (actor or {}).get('fullName'),
                'decidedAt': datetime.utcnow(),
                'status': 'read',
                'readAt': datetime.utcnow(),
            }
        },
    )


def send_otp_email(to_email: str, otp: str) -> None:
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        raise HTTPException(
            status_code=500,
            detail='Email server is not configured. Set SMTP_HOST, SMTP_USER, and SMTP_PASSWORD.',
        )

    message = EmailMessage()
    message['Subject'] = 'Call Center Registration OTP'
    message['From'] = SMTP_FROM
    message['To'] = to_email
    message.set_content(
        f'Your one-time verification code is: {otp}\n\n'
        'Enter this code in the registration form to complete your account setup. '
        'The code expires in 10 minutes.'
    )

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f'Failed to send OTP email: {exc}')


def send_manager_approval_email(approval: dict) -> None:
    if not SMTP_HOST or not SMTP_USER or not SMTP_PASSWORD:
        return

    approval_email = quote(approval['email'])
    approve_link = f"{APP_BASE_URL}/api/auth/manager-approval/approve?email={approval_email}"
    reject_link = f"{APP_BASE_URL}/api/auth/manager-approval/reject?email={approval_email}"

    message = EmailMessage()
    message['Subject'] = 'Manager approval request'
    message['From'] = SMTP_FROM
    message['To'] = PRIMARY_MANAGER_EMAIL
    message.set_content(
        f"{approval['fullName']} ({approval['email']}) requested manager access.\n\n"
        f"Approve: {approve_link}\n"
        f"Reject: {reject_link}"
    )
    message.add_alternative(
        f"<p>{approval['fullName']} ({approval['email']}) requested manager access.</p>"
        f"<p><a href=\"{approve_link}\">Approve request</a></p>"
        f"<p><a href=\"{reject_link}\">Reject request</a></p>",
        subtype='html',
    )

    context = ssl.create_default_context()
    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as server:
            if SMTP_USE_TLS:
                server.starttls(context=context)
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(message)
    except Exception:
        pass


def strip_private_fields(user: dict) -> dict:
    safe_user = {
        'fullName': user['fullName'],
        'email': user['email'],
        'role': user['role'],
        'employeeId': user['employeeId'],
        'createdAt': iso_date(user['createdAt']),
    }

    if user.get('managerId'):
        safe_user['managerId'] = user['managerId']

    if user.get('managerName'):
        safe_user['managerName'] = user['managerName']

    if user.get('managerCode'):
        safe_user['managerCode'] = user['managerCode']

    return safe_user


class RegisterInitRequest(BaseModel):
    fullName: constr(strip_whitespace=True, min_length=2)
    email: EmailStr
    password: constr(min_length=8)
    confirmPassword: constr(min_length=8)
    role: constr(pattern='^(Manager|Employee)$')
    managerCode: Optional[str] = ''


class LoginRequest(BaseModel):
    email: EmailStr
    password: constr(min_length=8)
    role: Optional[constr(pattern='^(Manager|Employee)$')] = None


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: constr(min_length=6, max_length=6)


class ResendRegistrationOtpRequest(BaseModel):
    email: EmailStr


class ResetInitiateRequest(BaseModel):
    email: EmailStr


class ResetCompleteRequest(BaseModel):
    email: EmailStr
    otp: constr(min_length=6, max_length=6)
    newPassword: constr(min_length=8)
    confirmPassword: constr(min_length=8)


class ApprovalDecisionRequest(BaseModel):
    approvalId: str
    decision: constr(pattern='^(approved|rejected)$')


class ManagerApprovalRequest(BaseModel):
    email: EmailStr
    decision: constr(pattern='^(approved|rejected)$')


@app.post('/api/auth/register-initiate')
def register_initiate(payload: RegisterInitRequest):
    email = normalize_email(payload.email)
    role = payload.role

    if payload.password != payload.confirmPassword:
        raise HTTPException(status_code=400, detail='Passwords do not match.')

    validate_password(payload.password)

    if users_collection.find_one({'email': email}):
        raise HTTPException(status_code=400, detail='An account already exists for this email.')

    manager = None
    if role == 'Employee':
        manager = manager_by_code(payload.managerCode)
        if not manager:
            raise HTTPException(status_code=400, detail='Enter a valid manager code to request employee access.')

    otp = f'{random.randint(100000, 999999)}'
    pending_doc = {
        'email': email,
        'fullName': payload.fullName.strip(),
        'passwordHash': hash_password(payload.password),
        'role': role,
        'employeeId': create_employee_id(role),
        'createdAt': datetime.utcnow(),
        'otpHash': hash_password(otp),
        'otpExpiresAt': datetime.utcnow() + timedelta(minutes=10),
        'approvalStatus': 'pending',
    }

    if manager:
        pending_doc.update(
            {
                'managerId': manager['employeeId'],
                'managerName': manager.get('fullName'),
                'managerEmail': manager.get('email'),
                'managerCode': manager.get('managerCode'),
            }
        )

    pending_collection.replace_one(
        {'email': email},
        pending_doc,
        upsert=True,
    )

    send_otp_email(email, otp)
    return {'ok': True, 'message': 'OTP sent to your email address. Please enter it to complete registration.'}


@app.post('/api/auth/register-resend-otp')
def register_resend_otp(payload: ResendRegistrationOtpRequest):
    email = normalize_email(payload.email)
    pending = pending_collection.find_one({'email': email})

    if not pending:
        raise HTTPException(status_code=400, detail='No pending registration found for this email.')

    if users_collection.find_one({'email': email}):
        pending_collection.delete_one({'email': email})
        raise HTTPException(status_code=400, detail='An account already exists for this email.')

    otp = f'{random.randint(100000, 999999)}'
    pending_collection.update_one(
        {'email': email},
        {
            '$set': {
                'otpHash': hash_password(otp),
                'otpExpiresAt': datetime.utcnow() + timedelta(minutes=10),
            }
        },
    )

    send_otp_email(email, otp)
    return {'ok': True, 'message': 'A new OTP has been sent to your email address.'}


@app.post('/api/auth/register-verify')
def register_verify(payload: VerifyOtpRequest):
    email = normalize_email(payload.email)
    pending = pending_collection.find_one({'email': email})

    if not pending:
        raise HTTPException(status_code=400, detail='No pending registration found for this email.')

    if pending['otpExpiresAt'] < datetime.utcnow():
        pending_collection.delete_one({'email': email})
        raise HTTPException(status_code=400, detail='OTP has expired. Start registration again.')

    if not verify_password(payload.otp, pending['otpHash']):
        raise HTTPException(status_code=400, detail='OTP is invalid. Please try again.')

    if pending.get('approvalStatus') == 'pending':
        if pending.get('role') == 'Employee' and not pending.get('managerId'):
            raise HTTPException(status_code=400, detail='Employee registration must include a valid manager code.')

        approval_doc = {
            'email': pending['email'],
            'fullName': pending['fullName'],
            'passwordHash': pending['passwordHash'],
            'role': pending['role'],
            'employeeId': pending['employeeId'],
            'createdAt': pending['createdAt'],
            'status': 'pending',
            'requestedAt': datetime.utcnow(),
        }

        if pending.get('role') == 'Employee':
            approval_doc.update(
                {
                    'managerId': pending.get('managerId'),
                    'managerName': pending.get('managerName'),
                    'managerEmail': pending.get('managerEmail'),
                    'managerCode': pending.get('managerCode'),
                }
            )

        employee_approvals_collection.replace_one({'email': email}, approval_doc, upsert=True)
        approval = employee_approvals_collection.find_one({'email': email, 'status': 'pending'})
        recipient_count = create_approval_request_messages(approval)

        if pending.get('role') == 'Employee' and recipient_count == 0:
            employee_approvals_collection.delete_one({'_id': approval['_id']})
            raise HTTPException(status_code=400, detail='The selected manager account is not available for approval.')

        if pending.get('role') == 'Manager' and recipient_count == 0:
            send_manager_approval_email(approval)

        pending_collection.delete_one({'email': email})
        target = (
            f" to {pending.get('managerName')}'s inbox"
            if pending.get('role') == 'Employee' and pending.get('managerName')
            else ''
        )
        return {
            'ok': True,
            'message': f'{pending.get("role")} registration submitted for approval{target}. You will be able to log in after approval.',
            'requiresApproval': True,
            'role': pending.get('role'),
            'managerName': pending.get('managerName'),
        }

    user_doc = {
        'fullName': pending['fullName'],
        'email': pending['email'],
        'passwordHash': pending['passwordHash'],
        'role': pending['role'],
        'employeeId': pending['employeeId'],
        'createdAt': pending['createdAt'],
    }

    if pending.get('role') == 'Manager':
        user_doc['managerCode'] = create_manager_code()

    if pending.get('managerId'):
        user_doc['managerId'] = pending.get('managerId')
        user_doc['managerName'] = pending.get('managerName')
        user_doc['managerEmail'] = pending.get('managerEmail')

    try:
        users_collection.insert_one(user_doc)
    except DuplicateKeyError:
        raise HTTPException(status_code=400, detail='An account already exists for this email.')
    finally:
        pending_collection.delete_one({'email': email})

    return {
        'ok': True,
        'message': 'Registration complete. You are now logged in.',
        'user': strip_private_fields(user_doc),
    }


@app.post('/api/auth/login')
def login(payload: LoginRequest):
    email = normalize_email(payload.email)
    pending_approval = employee_approvals_collection.find_one({'email': email, 'status': 'pending'})
    if pending_approval:
        role_label = pending_approval.get('role', 'account').lower()
        raise HTTPException(status_code=403, detail=f'Approval Pending. Your {role_label} registration is awaiting approval.')

    rejected_approval = employee_approvals_collection.find_one({'email': email, 'status': 'rejected'})
    if rejected_approval:
        role_label = rejected_approval.get('role', 'account').lower()
        raise HTTPException(status_code=403, detail=f'Registration Rejected. Your {role_label} registration was rejected.')

    user = users_collection.find_one({'email': email})

    if not user or not verify_password(payload.password, user['passwordHash']):
        raise HTTPException(status_code=401, detail='Invalid email or password.')

    if payload.role and user.get('role') != payload.role:
        raise HTTPException(status_code=403, detail=f'This account is registered as {user.get("role")}. Choose {user.get("role")} to log in.')

    user = ensure_manager_code(user)

    return {'ok': True, 'user': strip_private_fields(user)}


@app.post('/api/auth/reset-initiate')
def reset_initiate(payload: ResetInitiateRequest):
    email = normalize_email(payload.email)

    user = users_collection.find_one({'email': email})
    if not user:
        raise HTTPException(status_code=400, detail='No account found for this email.')

    otp = f'{random.randint(100000, 999999)}'
    password_resets.replace_one(
        {'email': email},
        {
            'email': email,
            'otpHash': hash_password(otp),
            'otpExpiresAt': datetime.utcnow() + timedelta(minutes=10),
        },
        upsert=True,
    )

    send_otp_email(email, otp)
    return {'ok': True, 'message': 'OTP sent to your email address. Use it to reset your password.', 'otp': otp}


@app.post('/api/auth/reset-complete')
def reset_complete(payload: ResetCompleteRequest):
    email = normalize_email(payload.email)

    if payload.newPassword != payload.confirmPassword:
        raise HTTPException(status_code=400, detail='Passwords do not match.')

    validate_password(payload.newPassword)

    reset = password_resets.find_one({'email': email})
    if not reset:
        raise HTTPException(status_code=400, detail='No password reset requested for this email.')

    if reset['otpExpiresAt'] < datetime.utcnow():
        password_resets.delete_one({'email': email})
        raise HTTPException(status_code=400, detail='OTP has expired. Start password reset again.')

    if not verify_password(payload.otp, reset['otpHash']):
        raise HTTPException(status_code=400, detail='OTP is invalid. Please try again.')

    result = users_collection.update_one(
        {'email': email}, {'$set': {'passwordHash': hash_password(payload.newPassword)}}
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=400, detail='No account found to update.')

    password_resets.delete_one({'email': email})
    user = users_collection.find_one({'email': email})

    return {'ok': True, 'message': 'Password reset successful. You can now log in with your new password.', 'user': strip_private_fields(user)}


def _approval_by_id(approval_id: str):
    try:
        object_id = ObjectId(approval_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid approval id.')

    approval = employee_approvals_collection.find_one({'_id': object_id, 'status': 'pending'})

    if not approval:
        raise HTTPException(status_code=404, detail='No pending approval found.')

    return approval


def user_doc_from_approval(approval: dict) -> dict:
    user_doc = {
        'fullName': approval['fullName'],
        'email': approval['email'],
        'passwordHash': approval['passwordHash'],
        'role': approval['role'],
        'employeeId': approval['employeeId'],
        'createdAt': approval['createdAt'],
    }

    if approval.get('role') == 'Manager':
        user_doc['managerCode'] = approval.get('managerCode') or create_manager_code()

    if approval.get('managerId'):
        user_doc['managerId'] = approval.get('managerId')
        user_doc['managerName'] = approval.get('managerName')
        user_doc['managerEmail'] = approval.get('managerEmail')

    return user_doc


def _process_approval(approval: dict, decision: str, actor: dict | None = None):
    now = datetime.utcnow()

    if decision == 'approved':
        user_doc = user_doc_from_approval(approval)

        try:
            users_collection.insert_one(user_doc)
        except DuplicateKeyError:
            pass

        employee_approvals_collection.update_one(
            {'_id': approval['_id']},
            {
                '$set': {
                    'status': 'approved',
                    'approvedAt': now,
                    'decisionBy': (actor or {}).get('employeeId'),
                    'decisionByName': (actor or {}).get('fullName'),
                }
            },
        )
        update_approval_request_messages(approval, 'approved', actor)
        create_requester_status_message(approval, 'approved', actor)
        role_label = approval.get('role', 'Account')
        return {'ok': True, 'message': f'{role_label} registration approved. The user can now log in.'}

    employee_approvals_collection.update_one(
        {'_id': approval['_id']},
        {
            '$set': {
                'status': 'rejected',
                'rejectedAt': now,
                'decisionBy': (actor or {}).get('employeeId'),
                'decisionByName': (actor or {}).get('fullName'),
            }
        },
    )
    update_approval_request_messages(approval, 'rejected', actor)
    create_requester_status_message(approval, 'rejected', actor)
    role_label = approval.get('role', 'Account')
    return {'ok': True, 'message': f'{role_label} registration rejected.'}


def _process_manager_approval(email: str, decision: str):
    approval = employee_approvals_collection.find_one({'email': email, 'role': 'Manager', 'status': 'pending'})

    if not approval:
        raise HTTPException(status_code=404, detail='No pending manager approval found for this email.')

    return _process_approval(approval, decision)


@app.post('/api/auth/manager-approval')
def manager_approval(payload: ManagerApprovalRequest):
    email = normalize_email(payload.email)
    return _process_manager_approval(email, payload.decision)


@app.get('/api/auth/inbox')
def get_inbox(request: Request):
    user = request_user(request)
    messages = list(
        inbox_collection.find({'recipientId': user['employeeId']})
        .sort('createdAt', -1)
        .limit(100)
    )
    unread_count = inbox_collection.count_documents({'recipientId': user['employeeId'], 'status': 'unread'})

    return {
        'ok': True,
        'messages': [serialize_inbox_message(message) for message in messages],
        'unreadCount': unread_count,
    }


@app.post('/api/auth/inbox/{message_id}/read')
def mark_inbox_message_read(message_id: str, request: Request):
    user = request_user(request)

    try:
        object_id = ObjectId(message_id)
    except Exception:
        raise HTTPException(status_code=400, detail='Invalid inbox message id.')

    result = inbox_collection.update_one(
        {'_id': object_id, 'recipientId': user['employeeId']},
        {'$set': {'status': 'read', 'readAt': datetime.utcnow()}},
    )

    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail='Inbox message not found.')

    return {'ok': True}


@app.post('/api/auth/approval-decision')
def approval_decision(payload: ApprovalDecisionRequest, request: Request):
    user = request_user(request)

    if user.get('role') != 'Manager':
        raise HTTPException(status_code=403, detail='Only managers can approve registration requests.')

    approval = _approval_by_id(payload.approvalId)

    if approval.get('role') == 'Employee' and approval.get('managerId') != user.get('employeeId'):
        raise HTTPException(status_code=403, detail='This employee request belongs to another manager.')

    return _process_approval(approval, payload.decision, user)


@app.get('/api/auth/manager-approval/approve')
def approve_manager_request(email: str):
    try:
        _process_manager_approval(normalize_email(email), 'approved')
        return HTMLResponse('<h2>Manager request approved</h2><p>The user can now log in.</p>')
    except HTTPException as exc:
        return HTMLResponse(f'<h2>Approval failed</h2><p>{exc.detail}</p>', status_code=exc.status_code)


@app.get('/api/auth/manager-approval/reject')
def reject_manager_request(email: str):
    try:
        _process_manager_approval(normalize_email(email), 'rejected')
        return HTMLResponse('<h2>Manager request rejected</h2><p>The user will remain unable to log in until a new request is made.</p>')
    except HTTPException as exc:
        return HTMLResponse(f'<h2>Rejection failed</h2><p>{exc.detail}</p>', status_code=exc.status_code)
