from fastapi import APIRouter, HTTPException, status, Depends, Header
from typing import Optional, List
from datetime import datetime, timezone
from pydantic import BaseModel
import json

from core.config import get_settings
from core.security import get_current_student
from db.supabase_client import get_supabase

router = APIRouter(prefix="/tech-relay", tags=["tech-relay"])
settings = get_settings()


# ── Schemas ──────────────────────────────────────────────────────

class RoundSubmission(BaseModel):
    round_number: int
    answer: str
    relay_name: str = "Tech Relay"
    question_index: Optional[int] = 0

class RoundConfigCreate(BaseModel):
    id: Optional[str] = None
    relay_name: str = "Tech Relay"
    round_number: int
    round_title: str
    round_type: str
    content: dict = {}
    correct_answer: Optional[str] = None
    time_limit_seconds: int = 0
    is_active: bool = False

class RelayToggle(BaseModel):
    relay_name: str = "Tech Relay"
    is_active: bool

class ForceUnlockRequest(BaseModel):
    student_id: str
    next_round: int
    relay_name: str = "Tech Relay"

class ResetStudentRequest(BaseModel):
    student_id: str
    relay_name: str = "Tech Relay"

class ResetRelayRequest(BaseModel):
    relay_name: str = "Tech Relay"

class ClearStrikesRequest(BaseModel):
    student_id: str
    relay_name: str = "Tech Relay"

class StartRelayRequest(BaseModel):
    start_code: str
    relay_name: str = "Tech Relay"

class ForceStopRelayRequest(BaseModel):
    relay_name: str = "Tech Relay"



# ── Admin Dependency ─────────────────────────────────────────────

async def verify_admin(x_admin_secret: str = Header(...)):
    if x_admin_secret != settings.admin_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid admin credentials"
        )
    return True


# ══════════════════════════════════════════════════════════════════
#  STUDENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════

def get_student_assigned_r1_index(student_id: str, relay_name: str, total_questions: int, db) -> int:
    """
    Get or compute assigned Round 1 question index for a student.
    Uses stored index in tech_relay_progress._meta if available.
    Fallback: deterministic hash based on student_id to ensure consistency.
    """
    if total_questions <= 1:
        return 0
    try:
        res = db.table("tech_relay_progress") \
            .select("rounds_completed") \
            .eq("student_id", student_id) \
            .eq("relay_name", relay_name) \
            .limit(1) \
            .execute()
        if res.data and len(res.data) > 0:
            rounds_completed = res.data[0].get("rounds_completed", [])
            if isinstance(rounds_completed, str):
                try:
                    rounds_completed = json.loads(rounds_completed)
                except Exception:
                    rounds_completed = []
            for item in rounds_completed:
                if isinstance(item, dict) and item.get("_meta"):
                    if "assigned_r1_index" in item and item["assigned_r1_index"] is not None:
                        return int(item["assigned_r1_index"]) % total_questions
    except Exception as e:
        print(f"[TECH_RELAY] get_assigned_r1_index note: {e}")

    # Fallback deterministic hash
    hash_val = sum(ord(c) for c in str(student_id))
    return hash_val % total_questions


DEFAULT_ROUND_1_GADGETS_CONTENT = {
    "title": "Identity Gadgets",
    "description": "Character clue puzzle: deduce the tech gadget from letter clues.",
    "questions": [
        {
            "id": "g1",
            "gadget_name": "CAMERA",
            "letters_count": 6,
            "correct_answer": "CAMERA",
            "clues": [
                {"letter": "C", "clue": "I am the first letter of the volatile memory type that loses its data when power is turned off."},
                {"letter": "A", "clue": "I am the middle vowel of the core computational unit that acts as the \"brain\" of a computer."},
                {"letter": "M", "clue": "I am the twelfth letter of the English alphabet, or rather, the midpoint of the alphabet right before N. (Note: M is the 13th, making this a fun trick!)"},
                {"letter": "E", "clue": "I am the repeating final letter found in both \"hardware\" and \"software\"."},
                {"letter": "R", "clue": "I am the primary consonant that initiates \"Random Access Memory\"."},
                {"letter": "A", "clue": "I am the vowel that sits alphabetically between Z and B... wait, no, I am the first vowel of the alphabet, ending this light-capturing device."}
            ]
        },
        {
            "id": "g2",
            "gadget_name": "ROUTER",
            "letters_count": 6,
            "correct_answer": "ROUTER",
            "clues": [
                {"letter": "R", "clue": "I am the first letter of the architecture style based on Reduced Instruction Set Computers."},
                {"letter": "O", "clue": "I am a binary digit’s twin in shape, representing the state of \"false\" or \"off\" in digital logic."},
                {"letter": "U", "clue": "I am the vowel found in the exact center of the word \"DEBUGGER\"."},
                {"letter": "T", "clue": "I am the consonant that forms the prefix for \"Terabyte\" and starts the technology known as \"TFT\" displays."},
                {"letter": "E", "clue": "I am the second vowel in the word \"INTERFACE\"."},
                {"letter": "R", "clue": "I am the terminating letter of the term \"Master\" in a Master-Slave network architecture."}
            ]
        },
        {
            "id": "g3",
            "gadget_name": "MODEM",
            "letters_count": 5,
            "correct_answer": "MODEM",
            "clues": [
                {"letter": "M", "clue": "I am the Roman numeral for one thousand, and the starting letter of a standard unit for measuring mega-transfer speeds."},
                {"letter": "O", "clue": "I am the letter shaped like a loop that represents an empty set in mathematics."},
                {"letter": "D", "clue": "I am the hexadecimal digit that represents the decimal value 13."},
                {"letter": "E", "clue": "I am the vowel that appears three times inside the word \"ENGINEERING\"."},
                {"letter": "M", "clue": "I am the final letter of this device, matching my position at the very beginning of the word."}
            ]
        },
        {
            "id": "g4",
            "gadget_name": "DRONE",
            "letters_count": 5,
            "correct_answer": "DRONE",
            "clues": [
                {"letter": "D", "clue": "I am the letter that designates a directory in command-line interfaces and represents 500 in Roman numerals."},
                {"letter": "R", "clue": "I am the symbol used in programming to denote raw strings or read permissions."},
                {"letter": "O", "clue": "I am the vowel that sits right between the letters N and P on a standard QWERTY keyboard."},
                {"letter": "N", "clue": "I am the symbol often used in physics and networking to represent total node count."},
                {"letter": "E", "clue": "I am the hexadecimal digit that represents the decimal value 14, and I close out this flying gadget."}
            ]
        },
        {
            "id": "g5",
            "gadget_name": "TABLET",
            "letters_count": 6,
            "correct_answer": "TABLET",
            "clues": [
                {"letter": "T", "clue": "I am the data type in programming that represents truth values (True/False)."},
                {"letter": "A", "clue": "I am the first letter of the hexadecimal sequence that comes after numbers 0 through 9."},
                {"letter": "B", "clue": "I am the base unit of digital storage prefix, or the second letter of a standard \"byte\"."},
                {"letter": "L", "clue": "I am the Roman numeral for 50, often found standing alone before a C."},
                {"letter": "E", "clue": "I am the character that represents \"Exponent\" in scientific notation numbers."},
                {"letter": "T", "clue": "I am a twin to the very first letter of this touch-screen device, closing out the word."}
            ]
        },
        {
            "id": "g6",
            "gadget_name": "SERVER",
            "letters_count": 6,
            "correct_answer": "SERVER",
            "clues": [
                {"letter": "S", "clue": "I am the letter used in cryptography to denote a secure protocol prefix (like HTTPS)."},
                {"letter": "E", "clue": "I am the most frequent vowel in the English language, appearing twice in this central network computer."},
                {"letter": "R", "clue": "I am the letter that denotes \"Register\" in low-level assembly language architecture."},
                {"letter": "V", "clue": "I am the Roman numeral for 5, and the consonant that starts the word for a virtual machine."},
                {"letter": "E", "clue": "I am the second instance of the most common vowel in this word."},
                {"letter": "R", "clue": "I am the concluding consonant, mirroring the letter found at the halfway mark of this word."}
            ]
        },
        {
            "id": "g7",
            "gadget_name": "SWITCH",
            "letters_count": 6,
            "correct_answer": "SWITCH",
            "clues": [
                {"letter": "S", "clue": "I am the letter used to denote a multi-branch conditional control statement in programming (like a case statement)."},
                {"letter": "W", "clue": "I am the letter that begins the global standard for Wide Area Networks."},
                {"letter": "I", "clue": "I am the integer variable name traditionally used as the primary loop counter in code."},
                {"letter": "T", "clue": "I am the letter representing \"Time\" complexity bounds in Big-O notation."},
                {"letter": "C", "clue": "I am the programming language developed by Dennis Ritchie that inspired C++ and Java."},
                {"letter": "H", "clue": "I am the letter that represents \"Hertz\", the unit of frequency, closing out this networking hardware."}
            ]
        },
        {
            "id": "g8",
            "gadget_name": "WEBCAM",
            "letters_count": 6,
            "correct_answer": "WEBCAM",
            "clues": [
                {"letter": "W", "clue": "I am the triple-letter prefix that initiates almost every URL on the World Wide Web."},
                {"letter": "E", "clue": "I am the baseline vowel of standard scientific notation exponent markers (like 1e10)."},
                {"letter": "B", "clue": "I am the binary digit prefix that differentiates a bit from a byte."},
                {"letter": "C", "clue": "I am the programming language tier that sits right below C++ and Python."},
                {"letter": "A", "clue": "I am the vowel that represents the hex value for 10."},
                {"letter": "M", "clue": "I am the metric prefix multiplier representing one-thousandth (10^{-3}), ending this video-streaming peripheral."}
            ]
        },
        {
            "id": "g9",
            "gadget_name": "SENSOR",
            "letters_count": 6,
            "correct_answer": "SENSOR",
            "clues": [
                {"letter": "S", "clue": "I am the letter representing \"Seconds\" as the base SI unit of time."},
                {"letter": "E", "clue": "I am the Euler's number constant (~2.718) in mathematical programming libraries."},
                {"letter": "N", "clue": "I am the variable typically used in mathematics and algorithms to represent a dynamic total input size."},
                {"letter": "S", "clue": "I am the twin sibling to the first letter of this environment-detecting hardware."},
                {"letter": "O", "clue": "I am the letter/digit that represents the octal number system base offset."},
                {"letter": "R", "clue": "I am the concluding letter of both \"Processor\" and this environmental data-gatherer."}
            ]
        },
        {
            "id": "g10",
            "gadget_name": "PRINTER",
            "letters_count": 7,
            "correct_answer": "PRINTER",
            "clues": [
                {"letter": "P", "clue": "I am the protocol letter that stands at the front of secure web traffic (HTTPS) or packet transmission."},
                {"letter": "R", "clue": "I am the symbol used in database management systems to represent a relational model."},
                {"letter": "I", "clue": "I am the imaginary unit in complex mathematics (i = \\sqrt{-1})."},
                {"letter": "N", "clue": "I am the mid-alphabet consonant that stands right between M and O."},
                {"letter": "T", "clue": "I am the unit of data throughput often measured in transactions per second."},
                {"letter": "E", "clue": "I am the baseline character for error exceptions in runtime environments."},
                {"letter": "R", "clue": "I am the closing consonant of this hardcopy output machine."}
            ]
        },
        {
            "id": "g11",
            "gadget_name": "HEADSET",
            "letters_count": 7,
            "correct_answer": "HEADSET",
            "clues": [
                {"letter": "H", "clue": "I am the first letter of the hardware part you wear over your ears, and I start the word \"Hardware\"."},
                {"letter": "E", "clue": "I am the most common vowel in the English language, and I sit right in the middle of the word \"NET\"."},
                {"letter": "A", "clue": "I am the first vowel of the alphabet, and I start the word \"Audio\"."},
                {"letter": "D", "clue": "I am the letter that comes right after C, and I start the word \"Data\"."},
                {"letter": "S", "clue": "I am the sibilant consonant that starts the word \"Sound\" and \"Speaker\"."},
                {"letter": "E", "clue": "I am the second-to-last letter, mirroring the vowel found in the middle of this wearable audio device."},
                {"letter": "T", "clue": "I am the consonant that crosses itself, ending both the words \"Tablet\" and \"Headset\"."}
            ]
        }
    ]
}

ROUND_2_PASSWORD_MAP = {
    # 1. Camera: 7F3A9K2D
    "CAMERA": "7F3A9K2D",

    # 2. Router: R@ut3r2025
    "ROUTER": "R@ut3r2025",

    # 3. Modem / Mini Router: 8Gk4#7m2P9
    "MODEM": "8Gk4#7m2P9",
    "MINI ROUTER": "8Gk4#7m2P9",
    "MINI_ROUTER": "8Gk4#7m2P9",

    # 4. Drone: 7F3A9X4D
    "DRONE": "7F3A9X4D",

    # 5. Tablet / Device: X7y8N9a5bC
    "TABLET": "X7y8N9a5bC",
    "DEVICE": "X7y8N9a5bC",

    # 6. Server / Server Rack: K8n9C5pL2
    "SERVER": "K8n9C5pL2",
    "SERVER RACK": "K8n9C5pL2",
    "SERVER_RACK": "K8n9C5pL2",

    # 7. Switch / Master Switch: ACCESS24B7T
    "SWITCH": "ACCESS24B7T",
    "MASTER SWITCH": "ACCESS24B7T",
    "MASTER_SWITCH": "ACCESS24B7T",

    # 8. Webcam: 7X9kL2mP4
    "WEBCAM": "7X9kL2mP4",

    # 9. Sensor / Sensor Unit: SENSOR95R1P
    "SENSOR": "SENSOR95R1P",
    "SENSOR UNIT": "SENSOR95R1P",
    "SENSOR_UNIT": "SENSOR95R1P",

    # 10. Printer: 42BLUEK7Y1P
    "PRINTER": "42BLUEK7Y1P",

    # 11. Headset / Soundbar: PWR588F32
    "HEADSET": "PWR588F32",
    "SOUNDBAR": "PWR588F32",
}

DEFAULT_ROUND_2_GATE_CONTENT = {
    "title": "Password Verification Gate",
    "instruction": "Verify your clearance by entering the security password corresponding to your Round 1 gadget to unlock Round 3.",
    "rule": "Password matching Round 1 Gadget Codename",
    "password_table": ROUND_2_PASSWORD_MAP
}

DEFAULT_ROUND_3_HTML_CONTENT = {
    "target_required": 3,
    "quiz_title": "HTML Basic Practice Assessment",
    "subject": "Web Technologies / Programming for Problem Solving",
    "questions": [
        {
            "id": "h1",
            "question": "What does HTML stand for?",
            "options": [
                "Hyper Trainer Marking Language",
                "Hyper Text Markup Language",
                "Hyper Text Marketing Language",
                "Hyper Tool Multi Language"
            ],
            "correct": 1,
            "explanation": "HTML stands for Hyper Text Markup Language, the standard markup language for web pages."
        },
        {
            "id": "h2",
            "question": "Which HTML tag is used to create the largest heading?",
            "options": ["<head>", "<h6>", "<heading>", "<h1>"],
            "correct": 3,
            "explanation": "<h1> defines the most important and largest heading, down to <h6> which is the smallest."
        },
        {
            "id": "h3",
            "question": "What is the correct HTML tag for inserting a line break?",
            "options": ["<lb>", "<break>", "<br>", "<ln>"],
            "correct": 2,
            "explanation": "<br> inserts a single line break in the text."
        },
        {
            "id": "h4",
            "question": "Which HTML tag is used to create a hyperlink?",
            "options": ["<link>", "<a>", "<href>", "<url>"],
            "correct": 1,
            "explanation": "The anchor tag <a> is used to create hyperlinks connecting one page to another."
        },
        {
            "id": "h5",
            "question": "Which attribute is used to specify the URL of an image in the <img> tag?",
            "options": ["src", "href", "link", "url"],
            "correct": 0,
            "explanation": "The src (source) attribute specifies the path/URL to the image file."
        },
        {
            "id": "h6",
            "question": "Which HTML element is used to define an unordered list (bulleted list)?",
            "options": ["<ol>", "<list>", "<ul>", "<bl>"],
            "correct": 2,
            "explanation": "<ul> creates an unordered bulleted list, whereas <ol> creates an ordered numbered list."
        },
        {
            "id": "h7",
            "question": "How can you make a text bold in HTML?",
            "options": ["<bold>", "<b>", "<bb>", "<emp>"],
            "correct": 1,
            "explanation": "The <b> tag (or <strong>) is used to render text in bold format."
        },
        {
            "id": "h8",
            "question": "Which character is used to indicate an end tag in HTML?",
            "options": ["^", "*", "/", "\\"],
            "correct": 2,
            "explanation": "A forward slash (< / >) is used inside the closing tag to denote the end of an element."
        },
        {
            "id": "h9",
            "question": "What is the correct HTML element for inserting an image?",
            "options": ["<image>", "<img>", "<pic>", "<src>"],
            "correct": 1,
            "explanation": "<img> is the standard tag used to embed images in an HTML document."
        },
        {
            "id": "h10",
            "question": "Which HTML element is used to create a table row?",
            "options": ["<tb>", "<tr>", "<td>", "<table-row>"],
            "correct": 1,
            "explanation": "<tr> stands for table row, which contains table cells (<td> or <th>)."
        }
    ]
}

DEFAULT_ROUND_4_TECH_QUIZ_CONTENT = {
    "target_required": 4,
    "quiz_title": "Introductory Engineering MCQ Assessment",
    "questions": [
        {
            "question": "Who is the co-founder and famous former CEO of Apple?",
            "options": ["Bill Gates", "Steve Jobs", "Elon Musk", "Mark Zuckerberg"],
            "correct": 1
        },
        {
            "question": "Which popular social media platform was founded by Mark Zuckerberg and his college roommates in 2004?",
            "options": ["Twitter", "Instagram", "Facebook", "LinkedIn"],
            "correct": 2
        },
        {
            "question": "Who is the billionaire entrepreneur behind companies like SpaceX and Tesla?",
            "options": ["Jeff Bezos", "Elon Musk", "Sundar Pichai", "Satya Nadella"],
            "correct": 1
        },
        {
            "question": "What does the \"USB\" acronym stand for in computer hardware?",
            "options": ["Universal Serial Bus", "Useful System Board", "Ultra Speed Byte", "Unified Software Bridge"],
            "correct": 0
        },
        {
            "question": "Which company created the popular Android mobile operating system?",
            "options": ["Apple", "Microsoft", "Google", "IBM"],
            "correct": 2
        },
        {
            "question": "What does \"Wi-Fi\" stand for in wireless networking?",
            "options": [
                "Wireless Fidelity",
                "Wide Field",
                "Wired Filter",
                "It doesn't stand for anything (it's just a catchphrase)"
            ],
            "correct": 3
        },
        {
            "question": "Who founded the e-commerce giant Amazon in 1994?",
            "options": ["Jeff Bezos", "Bill Gates", "Steve Jobs", "Larry Page"],
            "correct": 0
        },
        {
            "question": "What is the main function of a computer's RAM (Random Access Memory)?",
            "options": [
                "Permanent storage for photos and videos",
                "Temporary working memory for active tasks",
                "Cooling down the processor",
                "Supplying battery power"
            ],
            "correct": 1
        },
        {
            "question": "Which search engine was created by Larry Page and Sergey Brin while they were students at Stanford University?",
            "options": ["Yahoo", "Bing", "Google", "Ask Jeeves"],
            "correct": 2
        },
        {
            "question": "What does the \"PDF\" file format stand for?",
            "options": ["Portable Document Format", "Printable Data File", "Program Document Folder", "Public Digital File"],
            "correct": 0
        }
    ]
}

DEFAULT_ROUND_5_WORKFLOW_CONTENT = {
    "workflow_type": "10_step_master_password",
    "description": "Sequential 10-step interactive master key assembly with uppercase transformation",
    "steps": [
        {"step": 1, "name": "Base Name", "desc": "Initial codename/identifier string"},
        {"step": 2, "name": "Number Addition", "desc": "Append numeric entropy value"},
        {"step": 3, "name": "Math Challenge", "question": "14 × 7", "answer": "98"},
        {"step": 4, "name": "Brand Logo Selection", "options": ["NEXUS", "OCTOCAT", "CYBER"]},
        {"step": 5, "name": "Color Choice", "options": ["CYAN", "VIOLET", "EMERALD"]},
        {"step": 6, "name": "Tech Tag", "options": ["TS", "PY", "GO", "RUST"]},
        {"step": 7, "name": "Special Symbol", "options": ["!", "#", "$", "&"]},
        {"step": 8, "name": "Verification Digit", "digit": "7"},
        {"step": 9, "name": "String Assembly", "desc": "Sequential combined token stream"},
        {"step": 10, "name": "Final Master Password", "desc": "UPPERCASE encoding & vault unlock"},
    ],
    "math_num1": 14,
    "math_num2": 7,
    "math_op": "×",
    "math_answer": "98",
    "verify_digit": "7",
}


def auto_upgrade_rounds_to_latest(rounds: list, db) -> None:
    """Auto-upgrades rounds 1, 2, 3, 4, 5 to latest specifications:
    - Round 1: Identity Gadgets (11 Gadgets with Character Clues)
    - Round 2: Password Verification Gate (validates strictly against Round 1 answer's predefined security password)
    - Round 3: HTML Basic Practice Assessment (10 HTML MCQs, >= 3 correct needed)
    - Round 4: Tech Quiz (10 Introductory Engineering MCQs, >= 4 correct needed)
    - Round 5: Crack Final Password (10-step master key assembly)
    """
    for r in rounds:
        r_num = r.get("round_number")

        # Round 1: Identity Gadgets (11 Gadgets with Character Clues)
        if r_num == 1:
            r1_c = r.get("content")
            needs_r1_upgrade = False
            if not isinstance(r1_c, dict) or "questions" not in r1_c:
                needs_r1_upgrade = True
            elif len(r1_c.get("questions", [])) < 11:
                needs_r1_upgrade = True
            elif "volatile memory" not in json.dumps(r1_c).lower():
                needs_r1_upgrade = True

            if needs_r1_upgrade:
                try:
                    db.table("tech_relay_config").update({
                        "round_title": "Identity Gadgets",
                        "round_type": "gadget",
                        "correct_answer": "CAMERA",
                        "time_limit_seconds": 0,
                        "content": json.dumps(DEFAULT_ROUND_1_GADGETS_CONTENT),
                    }).eq("round_number", 1).execute()
                except Exception as e:
                    print(f"[TECH_RELAY] auto_upgrade Round 1 note: {e}")
                r["round_title"] = "Identity Gadgets"
                r["round_type"] = "gadget"
                r["correct_answer"] = "CAMERA"
                r["time_limit_seconds"] = 0
                r["content"] = DEFAULT_ROUND_1_GADGETS_CONTENT
            else:
                r["round_title"] = "Identity Gadgets"
                r["round_type"] = "gadget"
                r["correct_answer"] = "CAMERA"
                r["time_limit_seconds"] = 0

        # Round 2: Password Verification Gate
        if r_num == 2 and ("verification" not in str(r.get("round_title", "")).lower() or r.get("round_type") != "puzzle"):
            try:
                db.table("tech_relay_config").update({
                    "round_title": "Password Verification Gate",
                    "round_type": "puzzle",
                    "correct_answer": "VERIFY_ROUND1_PASSWORD",
                    "time_limit_seconds": 0,
                    "content": json.dumps(DEFAULT_ROUND_2_GATE_CONTENT),
                }).eq("round_number", 2).execute()
            except Exception as e:
                print(f"[TECH_RELAY] auto_upgrade Round 2 note: {e}")
            r["round_title"] = "Password Verification Gate"
            r["round_type"] = "puzzle"
            r["correct_answer"] = "VERIFY_ROUND1_PASSWORD"
            r["time_limit_seconds"] = 0
            r["content"] = DEFAULT_ROUND_2_GATE_CONTENT
        elif r_num == 2:
            r["round_title"] = "Password Verification Gate"
            r["round_type"] = "puzzle"
            r["correct_answer"] = "VERIFY_ROUND1_PASSWORD"
            r["time_limit_seconds"] = 0
            if not isinstance(r.get("content"), dict) or "password_table" not in r.get("content", {}):
                try:
                    db.table("tech_relay_config").update({
                        "content": json.dumps(DEFAULT_ROUND_2_GATE_CONTENT),
                    }).eq("round_number", 2).execute()
                except Exception:
                    pass
                r["content"] = DEFAULT_ROUND_2_GATE_CONTENT

        # Round 3: HTML Basic Practice Assessment (10 HTML MCQs, target 3)
        if r_num == 3 and (r.get("round_type") != "mcq" or "html" not in str(r.get("round_title", "")).lower()):
            try:
                db.table("tech_relay_config").update({
                    "round_title": "HTML Basic Practice Assessment",
                    "round_type": "mcq",
                    "correct_answer": "HTML_3_OF_10",
                    "time_limit_seconds": 0,
                    "content": json.dumps(DEFAULT_ROUND_3_HTML_CONTENT),
                }).eq("round_number", 3).execute()
            except Exception as e:
                print(f"[TECH_RELAY] auto_upgrade Round 3 note: {e}")
            r["round_title"] = "HTML Basic Practice Assessment"
            r["round_type"] = "mcq"
            r["correct_answer"] = "HTML_3_OF_10"
            r["time_limit_seconds"] = 0
            r["content"] = DEFAULT_ROUND_3_HTML_CONTENT
        elif r_num == 3:
            r["round_title"] = "HTML Basic Practice Assessment"
            r["round_type"] = "mcq"
            r["correct_answer"] = "HTML_3_OF_10"
            r["time_limit_seconds"] = 0
            if not isinstance(r.get("content"), dict) or len(r.get("content", {}).get("questions", [])) < 10:
                r["content"] = DEFAULT_ROUND_3_HTML_CONTENT

        # Round 4: Tech Quiz (10-question MCQ pool, target 4)
        if r_num == 4 and (r.get("round_type") != "mcq" or "quiz" not in str(r.get("round_title", "")).lower()):
            try:
                db.table("tech_relay_config").update({
                    "round_title": "Tech Quiz",
                    "round_type": "mcq",
                    "correct_answer": "MCQ_4_OF_10",
                    "time_limit_seconds": 0,
                    "content": json.dumps(DEFAULT_ROUND_4_TECH_QUIZ_CONTENT),
                }).eq("round_number", 4).execute()
            except Exception as e:
                print(f"[TECH_RELAY] auto_upgrade Round 4 note: {e}")
            r["round_title"] = "Tech Quiz"
            r["round_type"] = "mcq"
            r["correct_answer"] = "MCQ_4_OF_10"
            r["time_limit_seconds"] = 0
            r["content"] = DEFAULT_ROUND_4_TECH_QUIZ_CONTENT
        elif r_num == 4:
            r["round_title"] = "Tech Quiz"
            r["round_type"] = "mcq"
            r["correct_answer"] = "MCQ_4_OF_10"
            r["time_limit_seconds"] = 0
            if not isinstance(r.get("content"), dict) or len(r.get("content", {}).get("questions", [])) < 10 or "apple" not in json.dumps(r.get("content", {})).lower():
                r["content"] = DEFAULT_ROUND_4_TECH_QUIZ_CONTENT

        # Round 5: Ensure 10-step Crack Final Password format
        if r_num == 5:
            r["round_title"] = "Crack Final Password"
            r["round_type"] = "password"
            r["correct_answer"] = "CRACK_PASSWORD_10_STEP"
            r["time_limit_seconds"] = 0
            if not isinstance(r.get("content"), dict) or "workflow_type" not in r.get("content", {}):
                r["content"] = DEFAULT_ROUND_5_WORKFLOW_CONTENT


@router.get("/config")
async def get_relay_config(current: dict = Depends(get_current_student)):
    """Get active relay config with all rounds (strips correct answers for anti-cheat)."""
    db = get_supabase()
    try:
        result = db.table("tech_relay_config") \
            .select("id, relay_name, is_active, round_number, round_title, round_type, content, time_limit_seconds") \
            .eq("is_active", True) \
            .order("round_number") \
            .execute()
        rounds = result.data or []
        auto_upgrade_rounds_to_latest(rounds, db)

        sanitized_rounds = []
        for r in rounds:
            r_copy = dict(r)
            r_copy.pop("correct_answer", None)
            r_copy["time_limit_seconds"] = 0  # No time limit on any round
            round_num = r_copy.get("round_number")
            content = r_copy.get("content")
            if isinstance(content, str):
                try:
                    content = json.loads(content)
                except Exception:
                    content = {}
            if isinstance(content, dict):
                content_copy = dict(content)
                # If there are sub-questions in content, sanitize each question
                if "questions" in content_copy and isinstance(content_copy["questions"], list):
                    clean_questions = []
                    for q in content_copy["questions"]:
                        if isinstance(q, dict):
                            qc = dict(q)
                            qc.pop("correct_answer", None)
                            qc.pop("correct", None)
                            qc.pop("answer", None)
                            clean_questions.append(qc)
                        else:
                            clean_questions.append(q)

                    # Special Rule for Round 1:
                    # Each user gets ONLY ONE question assigned from the pool so different users get different questions!
                    if round_num == 1 and len(clean_questions) > 1:
                        assigned_idx = get_student_assigned_r1_index(
                            student_id=current["student_id"],
                            relay_name=r_copy.get("relay_name", "Tech Relay"),
                            total_questions=len(clean_questions),
                            db=db
                        )
                        content_copy["questions"] = [clean_questions[assigned_idx]]
                        content_copy["assigned_question_index"] = assigned_idx
                    else:
                        content_copy["questions"] = clean_questions

                r_copy["content"] = content_copy
            sanitized_rounds.append(r_copy)

        return {"rounds": sanitized_rounds}
    except Exception as e:
        print(f"[TECH_RELAY] Config fetch note: {e}")
        return {"rounds": []}


def extract_mcq_scores(rounds_completed: list):
    """
    Extracts separate MCQ scores for Round 3 (HTML Basic Assessment) and Round 4 (Tech Quiz).
    Official assessment score only counts Round 3 and Round 4 MCQs (each out of 10, total out of 20).
    """
    r3_score = 0
    r4_score = 0
    meta_info = {}

    for r in (rounds_completed or []):
        if isinstance(r, dict):
            if r.get("_meta"):
                meta_info = r
            elif r.get("round") == 3:
                r3_score = max(r3_score, int(r.get("score") or r.get("questions_solved") or 0))
            elif r.get("round") == 4:
                r4_score = max(r4_score, int(r.get("score") or r.get("questions_solved") or 0))

    if "r3_score" in meta_info and meta_info["r3_score"] is not None:
        r3_score = max(r3_score, int(meta_info["r3_score"]))
    if "r4_score" in meta_info and meta_info["r4_score"] is not None:
        r4_score = max(r4_score, int(meta_info["r4_score"]))

    total_score = r3_score + r4_score  # Total MCQs correct out of 20
    return r3_score, r4_score, total_score


@router.get("/progress")
async def get_relay_progress(current: dict = Depends(get_current_student)):
    """Get current student's relay progress including separate Round 3 & Round 4 MCQ scores."""
    db = get_supabase()
    student_id = current["student_id"]
    try:
        result = db.table("tech_relay_progress") \
            .select("*") \
            .eq("student_id", student_id) \
            .execute()

        if result.data and len(result.data) > 0:
            row = result.data[0]
            rounds_completed = row.get("rounds_completed", [])
            if isinstance(rounds_completed, str):
                try:
                    rounds_completed = json.loads(rounds_completed)
                except Exception:
                    rounds_completed = []

            current_question_index = 0
            clean_completed = []
            r1_answer = None
            r3_solved = []
            stopped_by_admin = False
            disqualified = False
            disqualification_reason = ""

            for item in rounds_completed:
                if isinstance(item, dict):
                    if item.get("_meta"):
                        current_question_index = item.get("current_question_index", 0)
                        if item.get("r1_answer"):
                            r1_answer = item["r1_answer"]
                        if item.get("r3_solved"):
                            r3_solved = item["r3_solved"]
                        if item.get("stopped_by_admin"):
                            stopped_by_admin = True
                        if item.get("disqualified"):
                            disqualified = True
                            disqualification_reason = item.get("disqualification_reason", "")
                    else:
                        clean_completed.append(item)
                        if item.get("round") == 1 and item.get("user_answer"):
                            r1_answer = item["user_answer"]
                        if item.get("round") == 3 and item.get("solved_indices"):
                            r3_solved = item["solved_indices"]

            r3_score, r4_score, final_score = extract_mcq_scores(rounds_completed)

            return {
                "id": row.get("id"),
                "student_id": row.get("student_id"),
                "relay_name": row.get("relay_name", "Tech Relay"),
                "current_round": row.get("current_round", 1),
                "current_question_index": current_question_index,
                "rounds_completed": clean_completed,
                "is_completed": row.get("is_completed", False),
                "started_at": row.get("started_at"),
                "completed_at": row.get("completed_at"),
                "r1_answer": r1_answer,
                "r3_solved": r3_solved,
                "stopped_by_admin": stopped_by_admin,
                "disqualified": disqualified,
                "disqualification_reason": disqualification_reason,
                "r3_score": r3_score,
                "r4_score": r4_score,
                "final_score": final_score,
                "total_mcq": 20,
            }

        return {
            "current_round": 1,
            "current_question_index": 0,
            "rounds_completed": [],
            "is_completed": False,
            "started_at": None,
            "completed_at": None,
            "r1_answer": None,
            "r3_solved": [],
            "stopped_by_admin": False,
            "r3_score": 0,
            "r4_score": 0,
            "final_score": 0,
            "total_mcq": 20,
        }
    except Exception as e:
        print(f"[TECH_RELAY] Progress fetch note: {e}")
        return {
            "current_round": 1,
            "current_question_index": 0,
            "rounds_completed": [],
            "is_completed": False,
            "started_at": None,
            "completed_at": None,
            "r1_answer": None,
            "r3_solved": [],
            "stopped_by_admin": False,
            "r3_score": 0,
            "r4_score": 0,
            "final_score": 0,
            "total_mcq": 20,
        }


@router.post("/start")
async def start_relay(body: StartRelayRequest, current: dict = Depends(get_current_student)):
    """Start Tech Relay by verifying access code ('Meet') and initializing student progress."""
    db = get_supabase()
    student_id = current["student_id"]
    relay_name = body.relay_name
    submitted_code = body.start_code.strip()

    # Validate start code ("Meet", case-insensitive)
    if submitted_code.lower() != "meet":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect Start Code! Please enter 'Meet' to start the challenge."
        )

    # Check if relay is active
    active_check = db.table("tech_relay_config") \
        .select("is_active") \
        .eq("relay_name", relay_name) \
        .eq("is_active", True) \
        .limit(1) \
        .execute()

    if not active_check.data or len(active_check.data) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Tech Relay is currently inactive. Please wait for the admin to activate it."
        )

    now = datetime.now(timezone.utc).isoformat()

    # Check existing progress
    existing = db.table("tech_relay_progress") \
        .select("*") \
        .eq("student_id", student_id) \
        .eq("relay_name", relay_name) \
        .execute()

    if existing.data and len(existing.data) > 0:
        row = existing.data[0]
        return {
            "success": True,
            "message": "Welcome back to Tech Relay!",
            "current_round": row.get("current_round", 1),
            "is_completed": row.get("is_completed", False),
            "started_at": row.get("started_at") or now
        }

    # Determine assigned Round 1 question for this participant (round-robin among existing pool)
    assigned_r1_index = 0
    try:
        count_res = db.table("tech_relay_progress") \
            .select("id") \
            .eq("relay_name", relay_name) \
            .execute()
        student_count = len(count_res.data) if (count_res.data and isinstance(count_res.data, list)) else 0

        r1_cfg = db.table("tech_relay_config") \
            .select("content") \
            .eq("relay_name", relay_name) \
            .eq("round_number", 1) \
            .limit(1) \
            .execute()
        if r1_cfg.data and len(r1_cfg.data) > 0:
            auto_upgrade_rounds_to_latest(r1_cfg.data, db)
            r1_content = r1_cfg.data[0].get("content", {})
            if isinstance(r1_content, str):
                try:
                    r1_content = json.loads(r1_content)
                except Exception:
                    r1_content = {}
            if isinstance(r1_content, dict) and "questions" in r1_content and isinstance(r1_content["questions"], list):
                pool_size = len(r1_content["questions"])
                if pool_size > 1:
                    assigned_r1_index = student_count % pool_size
    except Exception as e:
        print(f"[TECH_RELAY] start_relay assignment note: {e}")
        assigned_r1_index = sum(ord(c) for c in str(student_id)) % 5

    progress_data = {
        "student_id": student_id,
        "relay_name": relay_name,
        "current_round": 1,
        "rounds_completed": json.dumps([{
            "_meta": True,
            "assigned_r1_index": assigned_r1_index,
            "current_question_index": 0
        }]),
        "is_completed": False,
        "started_at": now,
        "completed_at": None,
    }

    insert_res = db.table("tech_relay_progress").insert(progress_data).execute()
    if not insert_res.data:
        raise HTTPException(status_code=500, detail="Failed to initialize relay progress")

    try:
        es_res = db.table("exam_status") \
            .select("id") \
            .eq("student_id", student_id) \
            .ilike("exam_name", "Tech Relay") \
            .execute()
        if es_res.data and len(es_res.data) > 0:
            for rec in es_res.data:
                db.table("exam_status").update({
                    "status": "in_progress",
                    "warnings": 0,
                    "started_at": now,
                    "submitted_at": None,
                }).eq("id", rec["id"]).execute()
        else:
            db.table("exam_status").insert({
                "student_id": student_id,
                "exam_name": "Tech Relay",
                "status": "in_progress",
                "warnings": 0,
                "started_at": now,
                "submitted_at": None,
            }).execute()
    except Exception as e:
        print(f"[TECH_RELAY] exam_status note: {e}")

    return {
        "success": True,
        "message": "Start Code verified! Welcome to Tech Relay.",
        "current_round": 1,
        "is_completed": False,
        "started_at": now
    }


@router.post("/submit-round")
async def submit_round(body: RoundSubmission, current: dict = Depends(get_current_student)):
    """Submit answer for a round or sub-question. Validates and advances progress."""
    db = get_supabase()
    student_id = current["student_id"]
    relay_name = body.relay_name
    round_num = body.round_number
    answer = body.answer.strip()
    q_idx = max(0, body.question_index or 0)

    # 1. Fetch the round config
    config_result = db.table("tech_relay_config") \
        .select("*") \
        .eq("relay_name", relay_name) \
        .eq("round_number", round_num) \
        .eq("is_active", True) \
        .limit(1) \
        .execute()

    if not config_result.data or len(config_result.data) == 0:
        raise HTTPException(status_code=404, detail="Round not found or not active")

    round_config = config_result.data[0]
    auto_upgrade_rounds_to_latest([round_config], db)
    round_type = round_config["round_type"]

    # 2. Check student is on this round (no skipping)
    progress_result = db.table("tech_relay_progress") \
        .select("*") \
        .eq("student_id", student_id) \
        .eq("relay_name", relay_name) \
        .execute()

    progress = progress_result.data[0] if (progress_result.data and len(progress_result.data) > 0) else None
    current_round = progress["current_round"] if progress else 1

    if round_num != current_round:
        raise HTTPException(status_code=400, detail=f"You must complete Round {current_round} first")

    if progress and progress.get("is_completed"):
        raise HTTPException(status_code=400, detail="You have already completed this relay")

    # 3. Parse content & check for multiple questions
    content = round_config.get("content", {})
    if isinstance(content, str):
        try:
            content = json.loads(content)
        except Exception:
            content = {}

    questions = content.get("questions") if isinstance(content, dict) else None
    has_multi_questions = isinstance(questions, list) and len(questions) > 0

    # Parse existing rounds_completed & meta_info
    rounds_completed = progress.get("rounds_completed", []) if progress else []
    if isinstance(rounds_completed, str):
        try:
            rounds_completed = json.loads(rounds_completed)
        except Exception:
            rounds_completed = []

    meta_info = next((r for r in rounds_completed if isinstance(r, dict) and r.get("_meta")), {})
    rounds_completed = [r for r in rounds_completed if not (isinstance(r, dict) and r.get("_meta"))]
    now = datetime.now(timezone.utc).isoformat()

    # ══════════════════════════════════════════════════════════════
    # ROUND 1: Identity Gadgets
    # ══════════════════════════════════════════════════════════════
    if round_num == 1:
        clean_ans = str(answer).strip().upper()

        # Official valid gadget names from Round 1
        valid_gadgets = {
            "CAMERA", "ROUTER", "MODEM", "DRONE", "TABLET",
            "SERVER", "SWITCH", "WEBCAM", "SENSOR", "PRINTER", "HEADSET",
            "MINI ROUTER", "MINI_ROUTER", "SOUNDBAR", "MASTER SWITCH",
            "MASTER_SWITCH", "SERVER RACK", "SERVER_RACK", "DEVICE",
            "SENSOR UNIT", "SENSOR_UNIT"
        }

        canonical_map = {
            "MINI ROUTER": "MODEM",
            "MINI_ROUTER": "MODEM",
            "DEVICE": "TABLET",
            "SERVER RACK": "SERVER",
            "SERVER_RACK": "SERVER",
            "MASTER SWITCH": "SWITCH",
            "MASTER_SWITCH": "SWITCH",
            "SENSOR UNIT": "SENSOR",
            "SENSOR_UNIT": "SENSOR",
            "SOUNDBAR": "HEADSET"
        }

        assigned_idx = get_student_assigned_r1_index(
            student_id=student_id,
            relay_name=relay_name,
            total_questions=len(questions) if has_multi_questions else 11,
            db=db
        )
        target_q = questions[assigned_idx] if (has_multi_questions and assigned_idx < len(questions)) else (questions[0] if has_multi_questions else {})
        expected = target_q.get("correct_answer") or target_q.get("answer") or target_q.get("gadget_name") or round_config.get("correct_answer") or ""

        # Validate answer: accept if matches expected gadget OR if it is any one of the official 11 gadgets
        if clean_ans != str(expected).strip().upper() and clean_ans not in valid_gadgets:
            return {"success": False, "message": "Incorrect gadget name! Check the character clues carefully and try again."}

        # Normalize canonical gadget name for session state & Round 2 password matching
        canonical_ans = canonical_map.get(clean_ans, clean_ans)
        meta_info["r1_answer"] = canonical_ans
        meta_info["current_question_index"] = 0

        existing_entry = next((r for r in rounds_completed if r.get("round") == 1), None)
        attempts = (existing_entry["attempts"] + 1) if existing_entry else 1

        rounds_completed = [r for r in rounds_completed if r.get("round") != 1]
        rounds_completed.append({
            "round": 1,
            "completed_at": now,
            "attempts": attempts,
            "questions_solved": 1,
            "user_answer": clean_ans
        })
        rounds_completed.append(meta_info)

        progress_data = {
            "student_id": student_id,
            "relay_name": relay_name,
            "current_round": 2,
            "rounds_completed": json.dumps(rounds_completed),
            "is_completed": False
        }
        if progress:
            db.table("tech_relay_progress").update(progress_data).eq("id", progress["id"]).execute()
        else:
            progress_data["started_at"] = now
            db.table("tech_relay_progress").insert(progress_data).execute()

        return {
            "success": True,
            "round_cleared": True,
            "message": f"🎉 Gadget '{clean_ans}' Solved! Round 2 (Password Verification Gate) Unlocked.",
            "next_round": 2,
            "next_question_index": 0,
            "r1_answer": clean_ans,
            "is_completed": False
        }

    # ══════════════════════════════════════════════════════════════
    # ROUND 2: Password Verification Gate
    # Strict predefined rule based on Round 1 answer
    # ══════════════════════════════════════════════════════════════
    elif round_num == 2:
        r1_ans = meta_info.get("r1_answer")
        if not r1_ans:
            for item in rounds_completed:
                if isinstance(item, dict) and item.get("round") == 1 and item.get("user_answer"):
                    r1_ans = item.get("user_answer")
                    break

        if not r1_ans:
            try:
                r1_cfg = db.table("tech_relay_config").select("content, correct_answer").eq("round_number", 1).limit(1).execute()
                if r1_cfg.data:
                    c1 = r1_cfg.data[0].get("content")
                    if isinstance(c1, str):
                        c1 = json.loads(c1)
                    if isinstance(c1, dict) and "questions" in c1 and len(c1["questions"]) > 0:
                        assigned_idx = get_student_assigned_r1_index(student_id, relay_name, len(c1["questions"]), db)
                        r1_ans = c1["questions"][assigned_idx].get("correct_answer") or c1["questions"][assigned_idx].get("gadget_name")
                    if not r1_ans:
                        r1_ans = r1_cfg.data[0].get("correct_answer")
            except Exception:
                pass

        if not r1_ans:
            r1_ans = "CAMERA"

        clean_r1 = str(r1_ans).strip().upper()
        expected_pwd = ROUND_2_PASSWORD_MAP.get(clean_r1)
        submitted_pwd = str(answer).strip()

        # Validate password:
        # 1. Exact match with expected security password
        # 2. Case-insensitive match with expected security password
        # 3. Fallback: match gadget name if entered
        is_valid = False
        if expected_pwd:
            if submitted_pwd == expected_pwd or submitted_pwd.upper() == expected_pwd.upper():
                is_valid = True
        if not is_valid and submitted_pwd.upper() == clean_r1:
            is_valid = True

        if not is_valid:
            return {
                "success": False,
                "message": f"Access Denied: Incorrect security password for gadget '{clean_r1}'. Please enter the exact security key."
            }

        existing_entry = next((r for r in rounds_completed if r.get("round") == 2), None)
        attempts = (existing_entry["attempts"] + 1) if existing_entry else 1

        rounds_completed = [r for r in rounds_completed if r.get("round") != 2]
        rounds_completed.append({
            "round": 2,
            "completed_at": now,
            "attempts": attempts,
            "questions_solved": 1,
            "user_answer": submitted_pwd
        })
        meta_info["current_question_index"] = 0
        rounds_completed.append(meta_info)

        progress_data = {
            "student_id": student_id,
            "relay_name": relay_name,
            "current_round": 3,
            "rounds_completed": json.dumps(rounds_completed),
            "is_completed": False
        }
        if progress:
            db.table("tech_relay_progress").update(progress_data).eq("id", progress["id"]).execute()
        else:
            progress_data["started_at"] = now
            db.table("tech_relay_progress").insert(progress_data).execute()

        return {
            "success": True,
            "round_cleared": True,
            "message": f"🔒 Access Granted! Security password verified for {clean_r1}. Round 3 (HTML Basic Practice Assessment) Unlocked!",
            "next_round": 3,
            "next_question_index": 0,
            "is_completed": False
        }

    # ══════════════════════════════════════════════════════════════
    # ROUND 3: HTML Basic Practice Assessment (10 MCQs, >= 3 correct needed)
    # ══════════════════════════════════════════════════════════════
    elif round_num == 3:
        html_questions = DEFAULT_ROUND_3_HTML_CONTENT["questions"]
        if has_multi_questions and len(questions) >= 10:
            html_questions = questions

        # Check if full quiz answers submitted as JSON
        submitted_answers = None
        try:
            if isinstance(answer, str) and "{" in answer:
                parsed = json.loads(answer)
                if isinstance(parsed, dict) and "answers" in parsed:
                    submitted_answers = parsed.get("answers", [])
            elif isinstance(answer, list):
                submitted_answers = answer
        except Exception:
            submitted_answers = None

        if submitted_answers is not None:
            if len(submitted_answers) < len(html_questions) or any(a is None or a == -1 for a in submitted_answers):
                return {
                    "success": False,
                    "message": f"Please answer all {len(html_questions)} HTML questions before submitting."
                }

            correct_count = 0
            for i, q in enumerate(html_questions):
                if i < len(submitted_answers) and int(submitted_answers[i]) == int(q.get("correct", 0)):
                    correct_count += 1

            meta_info["r3_score"] = correct_count

            if correct_count < 3:
                # Immediate Disqualification / Game Over: Failed Round 3 (< 3 correct)
                r3_score = correct_count
                r4_score = 0
                final_score = r3_score

                existing_entry = next((r for r in rounds_completed if r.get("round") == 3), None)
                attempts = (existing_entry["attempts"] + 1) if existing_entry else 1

                rounds_completed = [r for r in rounds_completed if r.get("round") != 3]
                rounds_completed.append({
                    "round": 3,
                    "completed_at": now,
                    "attempts": attempts,
                    "score": correct_count,
                    "total": len(html_questions),
                    "questions_solved": correct_count,
                    "passed": False
                })

                meta_info["r3_score"] = r3_score
                meta_info["r4_score"] = 0
                meta_info["final_score"] = final_score
                meta_info["disqualified"] = True
                meta_info["disqualification_reason"] = f"Scored {correct_count}/10 in Round 3. Minimum 3 correct answers required to advance."
                rounds_completed.append(meta_info)

                progress_data = {
                    "student_id": student_id,
                    "relay_name": relay_name,
                    "current_round": 3,
                    "rounds_completed": json.dumps(rounds_completed),
                    "is_completed": True,
                    "completed_at": now
                }
                if progress:
                    db.table("tech_relay_progress").update(progress_data).eq("id", progress["id"]).execute()
                else:
                    progress_data["started_at"] = now
                    db.table("tech_relay_progress").insert(progress_data).execute()

                # Update exam_status to disqualified
                try:
                    db.table("exam_status").update({
                        "status": "disqualified",
                        "submitted_at": now
                    }).eq("student_id", student_id).ilike("exam_name", relay_name).execute()
                except Exception:
                    pass

                # Upsert into exam_results for final score calculation
                try:
                    db.table("exam_results").upsert({
                        "student_id": student_id,
                        "exam_name": relay_name,
                        "score": final_score,
                        "total_marks": 20,
                        "submitted_at": now,
                        "answers": json.dumps({
                            "type": "tech_relay",
                            "disqualified": True,
                            "disqualification_reason": f"Scored {correct_count}/10 in Round 3 (Minimum 3 required)",
                            "failed_round": 3,
                            "r3_score": r3_score,
                            "r4_score": 0,
                            "r3_total": len(html_questions),
                            "r4_total": 10,
                            "total_score": final_score,
                            "total_mcq": 20
                        })
                    }).execute()
                except Exception:
                    pass

                return {
                    "success": False,
                    "disqualified": True,
                    "round_cleared": False,
                    "score": correct_count,
                    "total": len(html_questions),
                    "r3_score": r3_score,
                    "r4_score": 0,
                    "final_score": final_score,
                    "is_completed": True,
                    "message": f"🚫 Disqualified: You scored {correct_count}/10 in Round 3. Minimum 3 correct answers were required to unlock Round 4. Your challenge session has ended."
                }

            # Round 3 Cleared!
            existing_entry = next((r for r in rounds_completed if r.get("round") == 3), None)
            attempts = (existing_entry["attempts"] + 1) if existing_entry else 1

            rounds_completed = [r for r in rounds_completed if r.get("round") != 3]
            rounds_completed.append({
                "round": 3,
                "completed_at": now,
                "attempts": attempts,
                "score": correct_count,
                "total": len(html_questions),
                "questions_solved": correct_count
            })
            meta_info["current_question_index"] = 0
            meta_info["r3_score"] = correct_count
            rounds_completed.append(meta_info)

            progress_data = {
                "student_id": student_id,
                "relay_name": relay_name,
                "current_round": 4,
                "rounds_completed": json.dumps(rounds_completed),
                "is_completed": False
            }
            if progress:
                db.table("tech_relay_progress").update(progress_data).eq("id", progress["id"]).execute()
            else:
                progress_data["started_at"] = now
                db.table("tech_relay_progress").insert(progress_data).execute()

            return {
                "success": True,
                "round_cleared": True,
                "message": f"🎯 Outstanding! You scored {correct_count}/10 on HTML Assessment! (Minimum 3 required). Round 4 (Tech Quiz) Unlocked.",
                "next_round": 4,
                "next_question_index": 0,
                "is_completed": False
            }
        else:
            # Single question submission fallback
            if q_idx >= len(html_questions):
                q_idx = 0
            target_q = html_questions[q_idx]
            corr_opt = str(target_q.get("correct", 0))
            options = target_q.get("options", [])
            user_str = str(answer).strip().lower()
            is_correct = (
                user_str == corr_opt or
                (corr_opt.isdigit() and len(options) > int(corr_opt) and user_str == options[int(corr_opt)].strip().lower())
            )
            if not is_correct:
                return {
                    "success": False,
                    "message": f"Incorrect answer for Question {q_idx + 1}. Try again!"
                }

            r3_solved = set(meta_info.get("r3_solved", []))
            r3_solved.add(q_idx)
            solved_list = sorted(list(r3_solved))
            meta_info["r3_solved"] = solved_list
            solved_count = len(solved_list)

            if solved_count >= 3:
                existing_entry = next((r for r in rounds_completed if r.get("round") == 3), None)
                attempts = (existing_entry["attempts"] + 1) if existing_entry else 1

                rounds_completed = [r for r in rounds_completed if r.get("round") != 3]
                rounds_completed.append({
                    "round": 3,
                    "completed_at": now,
                    "attempts": attempts,
                    "questions_solved": solved_count,
                    "solved_indices": solved_list
                })
                meta_info["current_question_index"] = 0
                rounds_completed.append(meta_info)

                progress_data = {
                    "student_id": student_id,
                    "relay_name": relay_name,
                    "current_round": 4,
                    "rounds_completed": json.dumps(rounds_completed),
                    "is_completed": False
                }
                if progress:
                    db.table("tech_relay_progress").update(progress_data).eq("id", progress["id"]).execute()
                else:
                    progress_data["started_at"] = now
                    db.table("tech_relay_progress").insert(progress_data).execute()

                return {
                    "success": True,
                    "round_cleared": True,
                    "message": f"🎯 Superb! You answered {solved_count}/3 questions correctly! Round 4 (Tech Quiz) Unlocked.",
                    "next_round": 4,
                    "next_question_index": 0,
                    "r3_solved": solved_list,
                    "solved_count": solved_count,
                    "is_completed": False
                }
            else:
                rounds_completed.append(meta_info)
                progress_data = {
                    "student_id": student_id,
                    "relay_name": relay_name,
                    "current_round": 3,
                    "rounds_completed": json.dumps(rounds_completed),
                    "is_completed": False
                }
                if progress:
                    db.table("tech_relay_progress").update(progress_data).eq("id", progress["id"]).execute()
                else:
                    progress_data["started_at"] = now
                    db.table("tech_relay_progress").insert(progress_data).execute()

                return {
                    "success": True,
                    "round_cleared": False,
                    "message": f"✅ Question {q_idx + 1} Correct! ({solved_count}/3 required).",
                    "next_question_index": (q_idx + 1) % len(html_questions),
                    "r3_solved": solved_list,
                    "solved_count": solved_count,
                    "is_completed": False
                }

    # ══════════════════════════════════════════════════════════════
    # ROUND 4: Tech Quiz (10 MCQs, >= 4 correct needed)
    # ══════════════════════════════════════════════════════════════
    elif round_num == 4:
        quiz_questions = DEFAULT_ROUND_4_TECH_QUIZ_CONTENT["questions"]
        if has_multi_questions and len(questions) >= 10:
            quiz_questions = questions

        try:
            submitted = json.loads(answer) if isinstance(answer, str) and "{" in answer else {"answers": [answer]}
            submitted_answers = submitted.get("answers", [])
        except Exception:
            submitted_answers = []

        if len(submitted_answers) < len(quiz_questions):
            return {
                "success": False,
                "message": f"Please answer all {len(quiz_questions)} questions before submitting."
            }

        correct_count = 0
        for i, q in enumerate(quiz_questions):
            if i < len(submitted_answers) and int(submitted_answers[i]) == int(q.get("correct", 0)):
                correct_count += 1

        meta_info["r4_score"] = correct_count

        if correct_count < 4:
            # Immediate Disqualification / Game Over: Failed Round 4 (< 4 correct)
            r3_score = meta_info.get("r3_score", 0)
            r4_score = correct_count
            final_score = r3_score + r4_score

            existing_entry = next((r for r in rounds_completed if r.get("round") == 4), None)
            attempts = (existing_entry["attempts"] + 1) if existing_entry else 1

            rounds_completed = [r for r in rounds_completed if r.get("round") != 4]
            rounds_completed.append({
                "round": 4,
                "completed_at": now,
                "attempts": attempts,
                "score": correct_count,
                "total": len(quiz_questions),
                "questions_solved": correct_count,
                "passed": False
            })

            meta_info["r4_score"] = r4_score
            meta_info["final_score"] = final_score
            meta_info["disqualified"] = True
            meta_info["disqualification_reason"] = f"Scored {correct_count}/10 in Round 4. Minimum 4 correct answers required to advance."
            rounds_completed.append(meta_info)

            progress_data = {
                "student_id": student_id,
                "relay_name": relay_name,
                "current_round": 4,
                "rounds_completed": json.dumps(rounds_completed),
                "is_completed": True,
                "completed_at": now
            }
            if progress:
                db.table("tech_relay_progress").update(progress_data).eq("id", progress["id"]).execute()
            else:
                progress_data["started_at"] = now
                db.table("tech_relay_progress").insert(progress_data).execute()

            # Update exam_status to disqualified
            try:
                db.table("exam_status").update({
                    "status": "disqualified",
                    "submitted_at": now
                }).eq("student_id", student_id).ilike("exam_name", relay_name).execute()
            except Exception:
                pass

            # Upsert into exam_results for final score calculation
            try:
                db.table("exam_results").upsert({
                    "student_id": student_id,
                    "exam_name": relay_name,
                    "score": final_score,
                    "total_marks": 20,
                    "submitted_at": now,
                    "answers": json.dumps({
                        "type": "tech_relay",
                        "disqualified": True,
                        "disqualification_reason": f"Scored {correct_count}/10 in Round 4 (Minimum 4 required)",
                        "failed_round": 4,
                        "r3_score": r3_score,
                        "r4_score": r4_score,
                        "r3_total": 10,
                        "r4_total": len(quiz_questions),
                        "total_score": final_score,
                        "total_mcq": 20
                    })
                }).execute()
            except Exception:
                pass

            return {
                "success": False,
                "disqualified": True,
                "round_cleared": False,
                "score": correct_count,
                "total": len(quiz_questions),
                "r3_score": r3_score,
                "r4_score": r4_score,
                "final_score": final_score,
                "is_completed": True,
                "message": f"🚫 Disqualified: You scored {correct_count}/10 in Round 4. Minimum 4 correct answers were required to unlock Round 5. Your challenge session has ended."
            }

        existing_entry = next((r for r in rounds_completed if r.get("round") == 4), None)
        attempts = (existing_entry["attempts"] + 1) if existing_entry else 1

        rounds_completed = [r for r in rounds_completed if r.get("round") != 4]
        rounds_completed.append({
            "round": 4,
            "completed_at": now,
            "attempts": attempts,
            "questions_solved": correct_count,
            "score": correct_count,
            "total": len(quiz_questions)
        })
        meta_info["current_question_index"] = 0
        meta_info["r4_score"] = correct_count
        rounds_completed.append(meta_info)

        progress_data = {
            "student_id": student_id,
            "relay_name": relay_name,
            "current_round": 5,
            "rounds_completed": json.dumps(rounds_completed),
            "is_completed": False
        }
        if progress:
            db.table("tech_relay_progress").update(progress_data).eq("id", progress["id"]).execute()
        else:
            progress_data["started_at"] = now
            db.table("tech_relay_progress").insert(progress_data).execute()

        return {
            "success": True,
            "round_cleared": True,
            "message": f"🎉 Excellent! Score: {correct_count}/10 (4+ required). Final Round (Crack Password) Unlocked!",
            "next_round": 5,
            "next_question_index": 0,
            "score": correct_count,
            "total": len(quiz_questions),
            "is_completed": False
        }

    # ══════════════════════════════════════════════════════════════
    # ROUND 5: Crack Final Password (10-step master key assembly)
    # ══════════════════════════════════════════════════════════════
    elif round_num == 5:
        if len(str(answer).strip()) >= 5:
            is_correct = True
        else:
            expected = (round_config.get("correct_answer") or "").strip()
            is_correct = bool(expected and str(answer).strip().lower() == str(expected).strip().lower())

        if not is_correct:
            return {"success": False, "message": "Invalid master password. Complete the 10-step sequence to unlock the vault!"}

        existing_entry = next((r for r in rounds_completed if r.get("round") == 5), None)
        attempts = (existing_entry["attempts"] + 1) if existing_entry else 1

        rounds_completed = [r for r in rounds_completed if r.get("round") != 5]
        rounds_completed.append({
            "round": 5,
            "completed_at": now,
            "attempts": attempts,
            "questions_solved": 1
        })
        meta_info["current_question_index"] = 0

        # Calculate official MCQ score from Round 3 and Round 4 (out of 20)
        r3_score, r4_score, total_mcq_score = extract_mcq_scores(rounds_completed + [meta_info])
        meta_info["r3_score"] = r3_score
        meta_info["r4_score"] = r4_score
        meta_info["final_score"] = total_mcq_score
        rounds_completed.append(meta_info)

        progress_data = {
            "student_id": student_id,
            "relay_name": relay_name,
            "current_round": 6,
            "rounds_completed": json.dumps(rounds_completed),
            "is_completed": True,
            "completed_at": now
        }
        if progress:
            db.table("tech_relay_progress").update(progress_data).eq("id", progress["id"]).execute()
        else:
            progress_data["started_at"] = now
            db.table("tech_relay_progress").insert(progress_data).execute()

        # Update exam_status to submitted
        try:
            db.table("exam_status").update({
                "status": "submitted",
                "submitted_at": now
            }).eq("student_id", student_id).ilike("exam_name", relay_name).execute()
        except Exception:
            pass

        # Upsert into exam_results for official scoring (Score = R3 + R4 out of 20)
        try:
            db.table("exam_results").upsert({
                "student_id": student_id,
                "exam_name": relay_name,
                "score": total_mcq_score,
                "total_marks": 20,
                "submitted_at": now,
                "answers": json.dumps({
                    "type": "tech_relay",
                    "r3_score": r3_score,
                    "r4_score": r4_score,
                    "r3_total": 10,
                    "r4_total": 10,
                    "total_score": total_mcq_score,
                    "total_mcq": 20,
                    "all_rounds_cleared": True
                })
            }, on_conflict="student_id,exam_name").execute()
        except Exception as e_res:
            print(f"[TECH_RELAY] exam_results r5 upsert note: {e_res}")

        return {
            "success": True,
            "round_cleared": True,
            "message": "🏆 Relay Complete! Congratulations, you conquered all 5 rounds!",
            "next_round": None,
            "next_question_index": 0,
            "is_completed": True
        }

    else:
        raise HTTPException(status_code=400, detail="Invalid round number")


# ══════════════════════════════════════════════════════════════════
#  ADMIN ENDPOINTS (OBSERVER & CONFIG)
# ══════════════════════════════════════════════════════════════════

@router.get("/admin/config")
async def admin_get_config(_: bool = Depends(verify_admin)):
    """Get all relay configs for admin management."""
    try:
        db = get_supabase()
        result = db.table("tech_relay_config") \
            .select("*") \
            .order("relay_name") \
            .order("round_number") \
            .execute()
        rounds = result.data or []
        auto_upgrade_rounds_to_latest(rounds, db)
        for r in rounds:
            if isinstance(r.get("content"), str):
                try:
                    r["content"] = json.loads(r["content"])
                except Exception:
                    pass
        return {"rounds": rounds}
    except Exception as e:
        print(f"[TECH_RELAY] admin_get_config note: {e}")
        return {"rounds": []}


@router.post("/admin/config")
async def admin_save_round(body: RoundConfigCreate, _: bool = Depends(verify_admin)):
    """Create or update a relay round config."""
    try:
        db = get_supabase()

        existing = db.table("tech_relay_config") \
            .select("id") \
            .eq("relay_name", body.relay_name) \
            .eq("round_number", body.round_number) \
            .execute()

        data = body.model_dump()
        target_id = data.pop("id", None)

        if isinstance(data.get("content"), str):
            try:
                data["content"] = json.loads(data["content"])
            except Exception:
                data["content"] = {}

        if existing.data and len(existing.data) > 0:
            row_id = existing.data[0]["id"]
            result = db.table("tech_relay_config") \
                .update(data) \
                .eq("id", row_id) \
                .execute()
        elif target_id:
            result = db.table("tech_relay_config") \
                .update(data) \
                .eq("id", target_id) \
                .execute()
        else:
            result = db.table("tech_relay_config") \
                .insert(data) \
                .execute()

        if not result.data:
            raise HTTPException(status_code=500, detail="Failed to save round: no data returned from database")

        return result.data[0]
    except HTTPException:
        raise
    except Exception as e:
        err_msg = str(e)
        print(f"[TECH_RELAY] admin_save_round failed: {err_msg}")
        if "tech_relay_config" in err_msg or "PGRST205" in err_msg or "does not exist" in err_msg:
            raise HTTPException(
                status_code=400,
                detail="Database table 'tech_relay_config' does not exist yet! Please run migration_v17_tech_relay.sql in your Supabase SQL Editor."
            )
        raise HTTPException(status_code=500, detail=f"Database error: {err_msg}")


@router.delete("/admin/config/{config_id}")
async def admin_delete_round(config_id: str, _: bool = Depends(verify_admin)):
    """Delete a relay round config."""
    try:
        db = get_supabase()
        db.table("tech_relay_config").delete().eq("id", config_id).execute()
        return {"status": "deleted"}
    except Exception as e:
        print(f"[TECH_RELAY] admin_delete_round failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/admin/toggle")
async def admin_toggle_relay(body: RelayToggle, _: bool = Depends(verify_admin)):
    """Activate or deactivate all rounds for a relay."""
    try:
        db = get_supabase()
        db.table("tech_relay_config") \
            .update({"is_active": body.is_active}) \
            .eq("relay_name", body.relay_name) \
            .execute()
        return {"status": "active" if body.is_active else "inactive", "relay_name": body.relay_name}
    except Exception as e:
        print(f"[TECH_RELAY] admin_toggle_relay failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/students")
async def admin_get_relay_students(
    relay_name: str = "Tech Relay",
    include_all: bool = True,
    _: bool = Depends(verify_admin)
):
    """Fetch students for Tech Relay live observer. Defaults to only students who have started."""
    try:
        db = get_supabase()

        # 1. Fetch progress for this relay
        progress_res = db.table("tech_relay_progress") \
            .select("*") \
            .eq("relay_name", relay_name) \
            .execute()
        progress_list = progress_res.data or []
        progress_map = {p["student_id"]: p for p in progress_list}

        if not include_all and not progress_map:
            return {"students": []}

        # 2. Fetch student profiles
        if include_all:
            students_res = db.table("students").select("id, usn, name, branch, is_blocked").execute()
            students_list = students_res.data or []
        else:
            student_ids = list(progress_map.keys())
            students_res = db.table("students") \
                .select("id, usn, name, branch, is_blocked") \
                .in_("id", student_ids) \
                .execute()
            students_list = students_res.data or []

        # 3. Fetch violations count for strikes
        try:
            viol_res = db.table("violations").select("student_id").execute()
            viol_counts = {}
            for v in (viol_res.data or []):
                sid = v["student_id"]
                viol_counts[sid] = viol_counts.get(sid, 0) + 1
        except Exception:
            viol_counts = {}

        # 4. Assemble participant list
        participants = []
        for s in students_list:
            sid = s["id"]
            p = progress_map.get(sid)

            if not include_all and not p:
                continue

            rounds_completed = []
            current_q_idx = 0
            stopped_by_admin = False
            meta_info = {}
            if p:
                raw_rc = p.get("rounds_completed", [])
                if isinstance(raw_rc, str):
                    try:
                        raw_rc = json.loads(raw_rc)
                    except Exception:
                        raw_rc = []
                for item in raw_rc:
                    if isinstance(item, dict) and item.get("_meta"):
                        meta_info = item
                        current_q_idx = item.get("current_question_index", 0)
                        if item.get("stopped_by_admin"):
                            stopped_by_admin = True
                    else:
                        rounds_completed.append(item)

            r3_score, r4_score, total_mcq_score = extract_mcq_scores(raw_rc if p else [])
            cleared_rounds = len(rounds_completed)
            score = total_mcq_score

            participants.append({
                "student_id": sid,
                "usn": s.get("usn", ""),
                "name": s.get("name", "Unknown"),
                "branch": s.get("branch", ""),
                "is_blocked": s.get("is_blocked", False),
                "has_started": p is not None,
                "current_round": p.get("current_round", 1) if p else 1,
                "current_question_index": current_q_idx,
                "rounds_completed": rounds_completed,
                "cleared_rounds": cleared_rounds,
                "score": score,
                "r3_score": r3_score,
                "r4_score": r4_score,
                "total_mcq": 20,
                "stopped_by_admin": stopped_by_admin,
                "is_completed": p.get("is_completed", False) if p else False,
                "started_at": p.get("started_at") if p else None,
                "completed_at": p.get("completed_at") if p else None,
                "warnings": viol_counts.get(sid, 0),
            })

        # Sort: Completed first, then by current round descending
        participants.sort(key=lambda x: (
            1 if x["has_started"] else 0,
            1 if x["is_completed"] else 0,
            x["current_round"]
        ), reverse=True)

        return {"students": participants}
    except Exception as e:
        print(f"[TECH_RELAY] admin_get_relay_students error: {e}")
        return {"students": []}


@router.post("/admin/force-unlock")
async def admin_force_unlock(body: ForceUnlockRequest, _: bool = Depends(verify_admin)):
    """Force unlock or advance a student to a specific round."""
    try:
        db = get_supabase()
        now = datetime.now(timezone.utc).isoformat()

        existing = db.table("tech_relay_progress") \
            .select("*") \
            .eq("student_id", body.student_id) \
            .eq("relay_name", body.relay_name) \
            .execute()

        is_complete = body.next_round > 5

        rounds_completed = []
        for r in range(1, min(body.next_round, 6)):
            rounds_completed.append({
                "round": r,
                "completed_at": now,
                "attempts": 1,
                "forced": True
            })
        rounds_completed.append({"_meta": True, "current_question_index": 0})

        data = {
            "student_id": body.student_id,
            "relay_name": body.relay_name,
            "current_round": 6 if is_complete else body.next_round,
            "rounds_completed": json.dumps(rounds_completed),
            "is_completed": is_complete,
            "completed_at": now if is_complete else None,
        }

        if existing.data and len(existing.data) > 0:
            db.table("tech_relay_progress").update(data).eq("id", existing.data[0]["id"]).execute()
        else:
            data["started_at"] = now
            db.table("tech_relay_progress").insert(data).execute()

        # Also clear any security termination and strikes if the student had been locked out
        try:
            es_rows = db.table("exam_status") \
                .select("id") \
                .eq("student_id", body.student_id) \
                .ilike("exam_name", body.relay_name) \
                .execute()
            if es_rows.data and len(es_rows.data) > 0:
                for rec in es_rows.data:
                    db.table("exam_status").update({
                        "status": "in_progress",
                        "warnings": 0,
                        "submitted_at": None,
                    }).eq("id", rec["id"]).execute()
            else:
                db.table("exam_status").insert({
                    "student_id": body.student_id,
                    "exam_name": body.relay_name,
                    "status": "in_progress",
                    "warnings": 0,
                    "started_at": now,
                    "submitted_at": None,
                }).execute()
        except Exception as e_es:
            print(f"[TECH_RELAY] exam_status force unlock note: {e_es}")

        return {"success": True, "message": f"Unlocked Round {body.next_round} for student"}
    except Exception as e:
        print(f"[TECH_RELAY] admin_force_unlock error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/clear-strikes")
async def admin_clear_strikes(body: ClearStrikesRequest, _: bool = Depends(verify_admin)):
    """Clear all strikes/violations and unblock security termination for a student without resetting progress."""
    try:
        db = get_supabase()
        # Reset warnings to 0 and status back to active/in_progress
        try:
            db.table("exam_status") \
                .update({"status": "in_progress", "warnings": 0, "submitted_at": None}) \
                .eq("student_id", body.student_id) \
                .ilike("exam_name", body.relay_name) \
                .execute()
        except Exception as e_es:
            print(f"[TECH_RELAY] clear strikes exam_status update note: {e_es}")

        try:
            db.table("violations") \
                .delete() \
                .eq("student_id", body.student_id) \
                .ilike("exam_name", body.relay_name) \
                .execute()
        except Exception:
            try:
                db.table("violations") \
                    .delete() \
                    .eq("student_id", body.student_id) \
                    .execute()
            except Exception:
                pass

        return {"success": True, "message": "Strikes cleared and exam termination unblocked"}
    except Exception as e:
        print(f"[TECH_RELAY] admin_clear_strikes error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/reset-student")
async def admin_reset_student(body: ResetStudentRequest, _: bool = Depends(verify_admin)):
    """Reset all relay progress and anti-cheat strikes for a student so they can restart fresh."""
    try:
        db = get_supabase()
        # 1. Delete progress
        db.table("tech_relay_progress") \
            .delete() \
            .eq("student_id", body.student_id) \
            .eq("relay_name", body.relay_name) \
            .execute()

        # 2. Reset / delete exam_status so strikes and auto-submit are completely cleared
        try:
            db.table("exam_status") \
                .delete() \
                .eq("student_id", body.student_id) \
                .ilike("exam_name", body.relay_name) \
                .execute()
        except Exception as e_es:
            print(f"[TECH_RELAY] exam_status delete error: {e_es}")
            try:
                db.table("exam_status") \
                    .update({"warnings": 0, "status": "active", "submitted_at": None}) \
                    .eq("student_id", body.student_id) \
                    .ilike("exam_name", body.relay_name) \
                    .execute()
            except Exception:
                pass

        # 3. Clear violation records for this student and relay
        try:
            db.table("violations") \
                .delete() \
                .eq("student_id", body.student_id) \
                .ilike("exam_name", body.relay_name) \
                .execute()
        except Exception:
            try:
                db.table("violations") \
                    .delete() \
                    .eq("student_id", body.student_id) \
                    .execute()
            except Exception:
                pass

        return {"success": True, "message": "Student relay progress and strikes have been completely reset"}
    except Exception as e:
        print(f"[TECH_RELAY] admin_reset_student error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/reset-all")
async def admin_reset_all_relay(body: ResetRelayRequest, _: bool = Depends(verify_admin)):
    """Reset all student progress and strikes for a relay so the entire tournament can start fresh."""
    try:
        db = get_supabase()
        db.table("tech_relay_progress") \
            .delete() \
            .eq("relay_name", body.relay_name) \
            .execute()

        try:
            db.table("exam_status") \
                .delete() \
                .ilike("exam_name", body.relay_name) \
                .execute()
        except Exception as e_es:
            print(f"[TECH_RELAY] exam_status delete error on reset-all: {e_es}")
            try:
                db.table("exam_status") \
                    .update({"warnings": 0, "status": "active", "submitted_at": None}) \
                    .ilike("exam_name", body.relay_name) \
                    .execute()
            except Exception:
                pass

        try:
            db.table("violations") \
                .delete() \
                .ilike("exam_name", body.relay_name) \
                .execute()
        except Exception:
            pass

        return {"success": True, "message": f"All student progress and strikes for '{body.relay_name}' have been wiped. Tournament reset successfully."}
    except Exception as e:
        print(f"[TECH_RELAY] admin_reset_all_relay error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/admin/force-stop")
async def admin_force_stop_relay(body: ForceStopRelayRequest, _: bool = Depends(verify_admin)):
    """
    Forcefully stop Tech Relay for all active participants.
    Deactivates the relay config and freezes every in-progress student's state at their current point,
    calculating their score up to their stopping point (20 pts per cleared round, max 100),
    marking them as submitted, and writing official records to both tech_relay_progress and exam_results.
    """
    try:
        db = get_supabase()
        relay_name = body.relay_name
        now = datetime.now(timezone.utc).isoformat()

        # 1. Deactivate relay config
        try:
            db.table("tech_relay_config") \
                .update({"is_active": False}) \
                .eq("relay_name", relay_name) \
                .execute()
        except Exception as e_cfg:
            print(f"[TECH_RELAY] Deactivate config error: {e_cfg}")

        # 2. Fetch all participants in this relay
        progress_res = db.table("tech_relay_progress") \
            .select("*") \
            .eq("relay_name", relay_name) \
            .execute()

        all_prog = progress_res.data or []
        affected_count = 0

        for p in all_prog:
            # If already completed naturally, preserve their completed status
            if p.get("is_completed"):
                continue

            student_id = p["student_id"]
            raw_rc = p.get("rounds_completed", [])
            if isinstance(raw_rc, str):
                try:
                    raw_rc = json.loads(raw_rc)
                except Exception:
                    raw_rc = []

            clean_rc = [r for r in raw_rc if not (isinstance(r, dict) and r.get("_meta"))]
            meta_info = next((r for r in raw_rc if isinstance(r, dict) and r.get("_meta")), {})

            r3_score, r4_score, total_mcq_score = extract_mcq_scores(raw_rc)
            cleared_rounds = len(clean_rc)

            meta_info["stopped_by_admin"] = True
            meta_info["final_score"] = total_mcq_score
            meta_info["r3_score"] = r3_score
            meta_info["r4_score"] = r4_score
            meta_info["cleared_rounds"] = cleared_rounds
            meta_info["stopped_at_round"] = p.get("current_round", 1)
            meta_info["stopped_at"] = now

            final_rc = clean_rc + [meta_info]

            # Update tech_relay_progress
            db.table("tech_relay_progress").update({
                "is_completed": True,
                "completed_at": now,
                "rounds_completed": json.dumps(final_rc),
            }).eq("id", p["id"]).execute()

            # Update exam_status to submitted
            try:
                es_rows = db.table("exam_status") \
                    .select("id") \
                    .eq("student_id", student_id) \
                    .ilike("exam_name", relay_name) \
                    .execute()
                if es_rows.data and len(es_rows.data) > 0:
                    for rec in es_rows.data:
                        db.table("exam_status").update({
                            "status": "submitted",
                            "submitted_at": now,
                        }).eq("id", rec["id"]).execute()
                else:
                    db.table("exam_status").insert({
                        "student_id": student_id,
                        "exam_name": relay_name,
                        "status": "submitted",
                        "warnings": 0,
                        "started_at": p.get("started_at") or now,
                        "submitted_at": now,
                    }).execute()
            except Exception as e_es:
                print(f"[TECH_RELAY] exam_status force stop note: {e_es}")

            # Upsert into exam_results for official grading (Score = R3 + R4 out of 20)
            try:
                res_payload = {
                    "student_id": student_id,
                    "exam_name": relay_name,
                    "score": total_mcq_score,
                    "total_marks": 20,
                    "submitted_at": now,
                    "answers": json.dumps({
                        "type": "tech_relay",
                        "stopped_by_admin": True,
                        "r3_score": r3_score,
                        "r4_score": r4_score,
                        "r3_total": 10,
                        "r4_total": 10,
                        "total_score": total_mcq_score,
                        "total_mcq": 20,
                        "cleared_rounds": cleared_rounds,
                        "stopped_at_round": p.get("current_round", 1),
                        "rounds_completed": clean_rc,
                    })
                }
                db.table("exam_results").upsert(res_payload, on_conflict="student_id,exam_name").execute()
            except Exception as e_res:
                print(f"[TECH_RELAY] exam_results upsert note: {e_res}")

            affected_count += 1

        return {
            "success": True,
            "message": f"Tech Relay stopped. {affected_count} active contestant(s) finalized up to their current point.",
            "affected_count": affected_count,
        }
    except Exception as e:
        print(f"[TECH_RELAY] admin_force_stop_relay error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/admin/student/{student_id}")
async def admin_remove_student(student_id: str, relay_name: str = "Tech Relay", _: bool = Depends(verify_admin)):
    """Remove student record from tech_relay_progress."""
    try:
        db = get_supabase()
        db.table("tech_relay_progress") \
            .delete() \
            .eq("student_id", student_id) \
            .eq("relay_name", relay_name) \
            .execute()
        return {"success": True, "message": "Student removed from relay"}
    except Exception as e:
        print(f"[TECH_RELAY] admin_remove_student error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/admin/leaderboard")
async def admin_leaderboard(relay_name: str = "Tech Relay", _: bool = Depends(verify_admin)):
    """Get leaderboard of completed students with separate Round 3 & Round 4 MCQ counts."""
    try:
        db = get_supabase()

        progress_result = db.table("tech_relay_progress") \
            .select("student_id, current_round, rounds_completed, is_completed, started_at, completed_at") \
            .eq("relay_name", relay_name) \
            .order("is_completed", desc=True) \
            .order("completed_at") \
            .execute()

        if not progress_result.data:
            return {"leaderboard": []}

        student_ids = [p["student_id"] for p in progress_result.data]
        students_result = db.table("students") \
            .select("id, usn, name, branch") \
            .in_("id", student_ids) \
            .execute()
        students_map = {s["id"]: s for s in (students_result.data or [])}

        leaderboard = []
        for p in progress_result.data:
            student = students_map.get(p["student_id"], {})
            rounds_completed = p.get("rounds_completed", [])
            if isinstance(rounds_completed, str):
                try:
                    rounds_completed = json.loads(rounds_completed)
                except Exception:
                    rounds_completed = []

            clean_rc = [r for r in rounds_completed if not (isinstance(r, dict) and r.get("_meta"))]
            meta_info = next((r for r in rounds_completed if isinstance(r, dict) and r.get("_meta")), {})
            total_attempts = sum(r.get("attempts", 1) for r in clean_rc)
            stopped_by_admin = meta_info.get("stopped_by_admin", False)
            cleared_rounds = len(clean_rc)

            r3_score, r4_score, total_mcq_score = extract_mcq_scores(rounds_completed)

            leaderboard.append({
                "student_id": p["student_id"],
                "usn": student.get("usn", ""),
                "name": student.get("name", "Unknown"),
                "branch": student.get("branch", ""),
                "current_round": p["current_round"],
                "rounds_completed": cleared_rounds,
                "score": total_mcq_score,
                "r3_score": r3_score,
                "r4_score": r4_score,
                "total_mcq": 20,
                "stopped_by_admin": stopped_by_admin,
                "total_attempts": total_attempts,
                "is_completed": p["is_completed"],
                "started_at": p["started_at"],
                "completed_at": p["completed_at"],
            })

        # Sort leaderboard by score (R3+R4 MCQs) descending, then by completed_at ascending
        leaderboard.sort(key=lambda x: (
            x.get("score", 0),
            1 if x.get("is_completed") else 0
        ), reverse=True)

        return {"leaderboard": leaderboard}
    except Exception as e:
        print(f"[TECH_RELAY] admin_leaderboard note: {e}")
        return {"leaderboard": []}

