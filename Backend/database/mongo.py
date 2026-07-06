import os
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).resolve().parents[1] / ".env")

MONGODB_URI = os.getenv("MONGODB_URI") or os.getenv("MONGODB_URL", "mongodb://localhost:27017")
MONGODB_DB = os.getenv("MONGODB_DB", "call_center_auth")

client = MongoClient(MONGODB_URI)
db = client[MONGODB_DB]

users_collection = db.users
pending_collection = db.pending_registrations
employee_approvals_collection = db.employee_approvals
inbox_collection = db.inbox_messages
password_resets = db.password_resets
calls_collection = db.calls


def ensure_indexes():
    users_collection.create_index("email", unique=True)
    users_collection.create_index("employeeId", unique=True)
    users_collection.create_index("managerCode", unique=True, sparse=True)
    pending_collection.create_index("email", unique=True)
    employee_approvals_collection.create_index("email", unique=True)
    employee_approvals_collection.create_index([("managerId", 1), ("status", 1)])
    inbox_collection.create_index([("recipientId", 1), ("createdAt", -1)])
    inbox_collection.create_index([("approvalId", 1), ("recipientId", 1)])
    password_resets.create_index("email", unique=True)
    calls_collection.create_index([("employeeId", 1), ("createdAt", -1)])
    calls_collection.create_index([("createdAt", -1)])

    try:
        pending_collection.create_index("otpExpiresAt", expireAfterSeconds=600)
    except Exception:
        pass
