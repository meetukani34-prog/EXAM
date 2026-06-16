import re

file_path = r"c:\EXAM_new\EXAM\app\faculty\page.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Add import
if "FacultyStudentsTab" not in content:
    content = content.replace(
        'import FacultyQuestionsTab from "@/components/admin/FacultyQuestionsTab";',
        'import FacultyQuestionsTab from "@/components/admin/FacultyQuestionsTab";\nimport FacultyStudentsTab from "@/components/faculty/FacultyStudentsTab";'
    )

# 2. Update Tab type
content = content.replace(
    'type Tab = "home" | "questions" | "monitor" | "results";',
    'type Tab = "home" | "questions" | "monitor" | "results" | "students";'
)

# 3. Add NavButton
nav_button_html = """
          <button key={t} className={tab === t ? styles.navBtnActive : styles.navBtn} onClick={() => setTab(t)}>
            {t === "home" ? "🏠 Home" : t === "questions" ? "📝 Question Bank" : t === "monitor" ? "📡 Live Monitor" : t === "results" ? "📊 Results" : "👥 Students"}
          </button>
"""
content = re.sub(
    r'<button key=\{t\}.*?\n.*?\n.*?</button>',
    nav_button_html.strip(),
    content
)

nav_arr_replace = '(["home", "questions", "monitor", "results", "students"] as Tab[]).map'
content = content.replace('(["home", "questions", "monitor", "results"] as Tab[]).map', nav_arr_replace)

# 4. Add the tab rendering at the end, right before the last closing tags
if 'tab === "students"' not in content:
    students_tab_html = """
        {tab === "students" && (
          <div className={styles.fadeSlideIn}>
            <FacultyStudentsTab branches={profile.branches} />
          </div>
        )}
      </div>
    </div>
  );
}
"""
    content = re.sub(
        r'      </div>\n    </div>\n  \);\n}\n?$',
        students_tab_html,
        content
    )

with open(file_path, "w", encoding="utf-8") as f:
    f.write(content)

print("page.tsx patched successfully!")
