-- ============================================================
-- Migration V20: Tech Relay Rounds 1 to 4 Redefinition
-- 1. Round 1: Identity Gadgets (11 Gadgets with Character Clues)
-- 2. Round 2: Password Verification Gate (Validates based on Round 1 answer)
-- 3. Round 3: HTML Basic Practice Assessment (10 MCQs, >= 3 correct required)
-- 4. Round 4: Tech Quiz (10 MCQs, >= 4 correct required)
-- ============================================================

-- Disable RLS to allow backend service operations
ALTER TABLE IF EXISTS tech_relay_config DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS tech_relay_progress DISABLE ROW LEVEL SECURITY;

-- Round 1: Identity Gadgets (11 Gadgets with Letter Clues)
UPDATE tech_relay_config
SET 
  round_title = 'Identity Gadgets',
  round_type = 'gadget',
  time_limit_seconds = 0,
  correct_answer = 'CAMERA',
  content = $json${
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
  }$json$::jsonb
WHERE round_number = 1;

-- Round 2: Password Verification Gate
UPDATE tech_relay_config
SET 
  round_title = 'Password Verification Gate',
  round_type = 'puzzle',
  time_limit_seconds = 0,
  correct_answer = 'VERIFY_ROUND1_PASSWORD',
  content = $json${
    "title": "Password Verification Gate",
    "instruction": "Verify your clearance by entering the security password corresponding to your Round 1 gadget to unlock Round 3.",
    "rule": "Password matching Round 1 Gadget Codename",
    "password_table": {
      "CAMERA": "7F3A9K2D",
      "ROUTER": "R@ut3r2025",
      "MODEM": "8Gk4#7m2P9",
      "DRONE": "7F3A9X4D",
      "TABLET": "X7y8N9a5bC",
      "SERVER": "K8n9C5pL2",
      "SWITCH": "ACCESS24B7T",
      "WEBCAM": "7X9kL2mP4",
      "SENSOR": "SENSOR95R1P",
      "PRINTER": "42BLUEK7Y1P",
      "HEADSET": "PWR588F32"
    }
  }$json$::jsonb
WHERE round_number = 2;

-- Round 3: HTML Basic Practice Assessment (10 MCQs, >= 3 correct needed)
UPDATE tech_relay_config
SET 
  round_title = 'HTML Basic Practice Assessment',
  round_type = 'mcq',
  time_limit_seconds = 0,
  correct_answer = 'HTML_3_OF_10',
  content = $json${
    "target_required": 3,
    "quiz_title": "HTML Basic Practice Assessment",
    "subject": "Web Technologies / Programming for Problem Solving",
    "questions": [
      {
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
        "question": "Which HTML tag is used to create the largest heading?",
        "options": ["<head>", "<h6>", "<heading>", "<h1>"],
        "correct": 3,
        "explanation": "<h1> defines the most important and largest heading, down to <h6> which is the smallest."
      },
      {
        "question": "What is the correct HTML tag for inserting a line break?",
        "options": ["<lb>", "<break>", "<br>", "<ln>"],
        "correct": 2,
        "explanation": "<br> inserts a single line break in the text."
      },
      {
        "question": "Which HTML tag is used to create a hyperlink?",
        "options": ["<link>", "<a>", "<href>", "<url>"],
        "correct": 1,
        "explanation": "The anchor tag <a> is used to create hyperlinks connecting one page to another."
      },
      {
        "question": "Which attribute is used to specify the URL of an image in the <img> tag?",
        "options": ["src", "href", "link", "url"],
        "correct": 0,
        "explanation": "The src (source) attribute specifies the path/URL to the image file."
      },
      {
        "question": "Which HTML element is used to define an unordered list (bulleted list)?",
        "options": ["<ol>", "<list>", "<ul>", "<bl>"],
        "correct": 2,
        "explanation": "<ul> creates an unordered bulleted list, whereas <ol> creates an ordered numbered list."
      },
      {
        "question": "How can you make a text bold in HTML?",
        "options": ["<bold>", "<b>", "<bb>", "<emp>"],
        "correct": 1,
        "explanation": "The <b> tag (or <strong>) is used to render text in bold format."
      },
      {
        "question": "Which character is used to indicate an end tag in HTML?",
        "options": ["^", "*", "/", "\\"],
        "correct": 2,
        "explanation": "A forward slash (< / >) is used inside the closing tag to denote the end of an element."
      },
      {
        "question": "What is the correct HTML element for inserting an image?",
        "options": ["<image>", "<img>", "<pic>", "<src>"],
        "correct": 1,
        "explanation": "<img> is the standard tag used to embed images in an HTML document."
      },
      {
        "question": "Which HTML element is used to create a table row?",
        "options": ["<tb>", "<tr>", "<td>", "<table-row>"],
        "correct": 1,
        "explanation": "<tr> stands for table row, which contains table cells (<td> or <th>)."
      }
    ]
  }$json$::jsonb
WHERE round_number = 3;

-- Round 4: Tech Quiz (Pool of 10 MCQs, >= 4 correct needed)
UPDATE tech_relay_config
SET 
  round_title = 'Tech Quiz',
  round_type = 'mcq',
  time_limit_seconds = 0,
  correct_answer = 'MCQ_4_OF_10',
  content = $json${
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
        "options": ["Wireless Fidelity", "Wide Field", "Wired Filter", "It doesn't stand for anything (it's just a catchphrase)"],
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
  }$json$::jsonb
WHERE round_number = 4;
