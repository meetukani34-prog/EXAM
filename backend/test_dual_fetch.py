import requests
import json

payload = {
    "usn": "123",
    "password": "exam123"
}
res = requests.post("http://localhost:8001/api/auth/login", json=payload)
print("Login status:", res.status_code)
login_data = res.json()
token = login_data.get("access_token")

print("\n--- FETCHING QUESTIONS FOR 'meet' (Coding) ---")
res_q_meet = requests.get(
    "http://localhost:8001/api/exam/questions?title=meet",
    headers={"Authorization": f"Bearer {token}"}
)
print("Status:", res_q_meet.status_code)
q_meet = res_q_meet.json()
print("Questions count:", len(q_meet.get("questions", [])))
if q_meet.get("questions"):
    q = q_meet["questions"][0]
    print(f"Question text: {q.get('text')}")
    print(f"Question branch: {q.get('branch')}")
    print(f"Question category: {q.get('category')}")

print("\n--- FETCHING QUESTIONS FOR 'Meet' (Aptitude) ---")
res_q_Meet = requests.get(
    "http://localhost:8001/api/exam/questions?title=Meet",
    headers={"Authorization": f"Bearer {token}"}
)
print("Status:", res_q_Meet.status_code)
q_Meet = res_q_Meet.json()
print("Questions count:", len(q_Meet.get("questions", [])))
if q_Meet.get("questions"):
    q = q_Meet["questions"][0]
    print(f"Question text: {q.get('text')}")
    print(f"Question branch: {q.get('branch')}")
    print(f"Question category: {q.get('category')}")
