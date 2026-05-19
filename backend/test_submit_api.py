import requests
import json

base_url = "http://localhost:8001/api"

def test_flow():
    # 1. Login
    login_payload = {
        "usn": "123",
        "password": "exam123"
    }
    print("1. Logging in...")
    res = requests.post(f"{base_url}/auth/login", json=login_payload)
    print("Login Status:", res.status_code)
    login_data = res.json()
    if res.status_code != 200:
        print("Login failed:", login_data)
        return
    
    token = login_data.get("access_token")
    exam_title = login_data.get("exam_title")
    print(f"Token: {token[:15]}... | Exam: {exam_title}")
    
    headers = {"Authorization": f"Bearer {token}"}
    
    # 2. Start Exam
    print("\n2. Starting Exam...")
    res_start = requests.post(f"{base_url}/exam/start-exam?title={requests.utils.quote(exam_title)}", headers=headers)
    print("Start status:", res_start.status_code)
    try:
        print("Start response:", res_start.json())
    except Exception:
        print("Start raw:", res_start.text)
        
    # 3. Fetch Questions to get question ids
    print("\n3. Fetching Questions...")
    res_q = requests.get(f"{base_url}/exam/questions?title={requests.utils.quote(exam_title)}", headers=headers)
    print("Questions status:", res_q.status_code)
    q_data = res_q.json()
    questions = q_data.get("questions", [])
    print(f"Found {len(questions)} questions")
    
    # Build answers dictionary
    answers = {}
    for q in questions:
        # Just answer 'A' or first option
        answers[q["id"]] = "A"
    # Append __exam_title
    answers["__exam_title"] = exam_title
    
    # 4. Submit Exam
    print("\n4. Submitting Exam...")
    submit_payload = {"answers": answers}
    res_submit = requests.post(f"{base_url}/exam/submit-exam", json=submit_payload, headers=headers)
    print("Submit status:", res_submit.status_code)
    try:
        print("Submit response:", json.dumps(res_submit.json(), indent=2))
    except Exception:
        print("Submit raw:", res_submit.text)

if __name__ == "__main__":
    test_flow()
