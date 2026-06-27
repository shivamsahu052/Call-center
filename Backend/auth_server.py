import os
import random
import re
import smtplib
import ssl
from datetime import datetime, timedelta
from email.message import EmailMessage
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from passlib.context import CryptContext
from pydantic import BaseModel, EmailStr, constr
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError

load_dotenv()

MONGODB_URI = os.getenv('MONGODB_URI', 'mongodb://localhost:27017')
MONGODB_DB = os.getenv('MONGODB_DB', 'call_center_auth')
MANAGER_ENROLLMENT_KEY = os.getenv('MANAGER_ENROLLMENT_KEY', 'MANAGER-2026')
SMTP_HOST = os.getenv('SMTP_HOST')
SMTP_PORT = int(os.getenv('SMTP_PORT', '587'))
SMTP_USER = os.getenv('SMTP_USER')
SMTP_PASSWORD = os.getenv('SMTP_PASSWORD')
SMTP_FROM = os.getenv('SMTP_FROM', 'Call Center <noreply@example.com>')
SMTP_USE_TLS = os.getenv('SMTP_USE_TLS', 'true').lower() in ('1', 'true', 'yes')

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB]
users_collection = db.users
pending_collection = db.pending_registrations
password_resets = db.password_resets

users_collection.create_index('email', unique=True)
pending_collection.create_index('email', unique=True)
password_resets.create_index('email', unique=True)

try:
    pending_collection.create_index('otpExpiresAt', expireAfterSeconds=600)
except Exception:
    pass

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


def create_employee_id(role: str) -> str:
    prefix = 'MGR' if role == 'Manager' else 'EMP'
    while True:
        employee_id = f'{prefix}-{random.randint(100000, 999999)}'
        if not users_collection.find_one({'employeeId': employee_id}):
            return employee_id


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


def strip_private_fields(user: dict) -> dict:
    return {
        'fullName': user['fullName'],
        'email': user['email'],
        'role': user['role'],
        'employeeId': user['employeeId'],
        'createdAt': user['createdAt'].isoformat() if isinstance(user['createdAt'], datetime) else user['createdAt'],
    }


class RegisterInitRequest(BaseModel):
    fullName: constr(strip_whitespace=True, min_length=2)
    email: EmailStr
    password: constr(min_length=8)
    confirmPassword: constr(min_length=8)
    role: constr(pattern='^(Manager|Employee)$')
    managerKey: Optional[str] = ''


class LoginRequest(BaseModel):
    email: EmailStr
    password: constr(min_length=8)


class VerifyOtpRequest(BaseModel):
    email: EmailStr
    otp: constr(min_length=6, max_length=6)


class ResetInitiateRequest(BaseModel):
    email: EmailStr


class ResetCompleteRequest(BaseModel):
    email: EmailStr
    otp: constr(min_length=6, max_length=6)
    newPassword: constr(min_length=8)
    confirmPassword: constr(min_length=8)


@app.post('/api/auth/register-initiate')
def register_initiate(payload: RegisterInitRequest):
    email = normalize_email(payload.email)

    if payload.password != payload.confirmPassword:
        raise HTTPException(status_code=400, detail='Passwords do not match.')

    validate_password(payload.password)

    if users_collection.find_one({'email': email}):
        raise HTTPException(status_code=400, detail='An account already exists for this email.')

    if payload.role == 'Manager':
        if payload.managerKey.strip() != MANAGER_ENROLLMENT_KEY:
            raise HTTPException(status_code=400, detail='Manager enrollment key is invalid.')

    otp = f'{random.randint(100000, 999999)}'
    pending_collection.replace_one(
        {'email': email},
        {
            'email': email,
            'fullName': payload.fullName.strip(),
            'passwordHash': hash_password(payload.password),
            'role': payload.role,
            'employeeId': create_employee_id(payload.role),
            'createdAt': datetime.utcnow(),
            'otpHash': hash_password(otp),
            'otpExpiresAt': datetime.utcnow() + timedelta(minutes=10),
        },
        upsert=True,
    )

    send_otp_email(email, otp)
    return {'ok': True, 'message': 'OTP sent to your email address. Please enter it to complete registration.'}


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

    user_doc = {
        'fullName': pending['fullName'],
        'email': pending['email'],
        'passwordHash': pending['passwordHash'],
        'role': pending['role'],
        'employeeId': pending['employeeId'],
        'createdAt': pending['createdAt'],
    }

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
    user = users_collection.find_one({'email': email})

    if not user or not verify_password(payload.password, user['passwordHash']):
        raise HTTPException(status_code=401, detail='Invalid email or password.')

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
