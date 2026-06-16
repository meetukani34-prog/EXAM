import os, dotenv
dotenv.load_dotenv('backend/.env')
from supabase import create_client
import sys
sys.path.append('backend')
from routers.faculty import _get_faculty_exams, _get_branch_filter

db = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_KEY'])
faculty = {'faculty_id': '796a7c06-1fc8-43f4-9e74-5d459de27a1b', 'branches': ['DS', 'CSE', 'ECE', 'BCA-2', 'MBA-2', 'BBA-2'], 'is_admin': False}

faculty_exams = _get_faculty_exams(faculty, db)
print("faculty_exams:", len(faculty_exams), faculty_exams)

results_query = db.table('exam_results').select('*').in_('exam_name', faculty_exams).execute()
print("results before loop:", len(results_query.data))

enriched = []
for r in results_query.data:
    student_res = db.table('students').select('name, usn, branch, email').eq('id', r['student_id']).execute()
    print("student data:", student_res.data)
    if student_res.data:
        s = student_res.data[0]
        enriched.append(r)

print("Enriched count:", len(enriched))
