# app.py - Main Flask Application

import os
import uuid
from datetime import datetime
from flask import Flask, request, render_template, jsonify, send_from_directory
import psycopg2
from psycopg2.extras import RealDictCursor
import PyPDF2
import docx2txt
import re

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Ensure uploads directory exists
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

# Database connection
def get_db_connection():
    conn = psycopg2.connect(
        host="localhost",
        database="chatbot2",
        user="postgres",
        password="aryu"  # Use environment variables in production
    )
    conn.autocommit = True
    return conn

# Initialize database
def init_db():
    conn = get_db_connection()
    cur = conn.cursor()
    
    # Create resumes table
    cur.execute('''
    CREATE TABLE IF NOT EXISTS resumes (
        id SERIAL PRIMARY KEY,
        filename TEXT NOT NULL,
        original_filename TEXT NOT NULL,
        content TEXT NOT NULL,
        feedback TEXT,
        created_at TIMESTAMP NOT NULL
    )
    ''')
    
    cur.close()
    conn.close()

# Call init_db on startup
init_db()

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in {'pdf', 'docx', 'doc', 'txt'}

def extract_text_from_file(file_path):
    """Extract text from uploaded file based on file type"""
    extension = file_path.rsplit('.', 1)[1].lower()
    
    if extension == 'pdf':
        text = ""
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            for page_num in range(len(pdf_reader.pages)):
                text += pdf_reader.pages[page_num].extract_text()
        return text
    
    elif extension == 'docx':
        return docx2txt.process(file_path)
    
    elif extension == 'txt':
        with open(file_path, 'r', encoding='utf-8') as file:
            return file.read()
    
    return ""

def analyze_resume(text):
    """Analyze resume text and provide feedback"""
    feedback = {
        "overall": [],
        "sections": {},
        "improvement_suggestions": []
    }
    
    # Check length
    word_count = len(re.findall(r'\w+', text))
    if word_count < 300:
        feedback["overall"].append("Your resume is quite short. Consider adding more details about your experience and skills.")
    elif word_count > 700:
        feedback["overall"].append("Your resume is quite lengthy. Consider condensing it to highlight the most relevant information.")
    
    # Check for common resume sections
    sections = {
        "contact": bool(re.search(r'(email|phone|address|linkedin)', text.lower())),
        "education": bool(re.search(r'(education|university|college|degree|bachelor|master|phd)', text.lower())),
        "experience": bool(re.search(r'(experience|work|job|position|employer)', text.lower())),
        "skills": bool(re.search(r'(skills|abilities|proficient|proficiency)', text.lower())),
        "projects": bool(re.search(r'(project|portfolio|development)', text.lower()))
    }
    
    # Provide feedback on missing sections
    feedback["sections"] = sections
    for section, present in sections.items():
        if not present:
            feedback["improvement_suggestions"].append(f"Consider adding a {section.capitalize()} section to your resume.")
    
    # Check for action verbs
    action_verbs = ['managed', 'developed', 'created', 'implemented', 'designed', 'led', 'coordinated', 'achieved', 'improved', 'increased']
    action_verb_count = sum(1 for verb in action_verbs if verb in text.lower())
    
    if action_verb_count < 3:
        feedback["improvement_suggestions"].append("Use more action verbs to describe your accomplishments and responsibilities.")
    
    # Check for quantifiable achievements
    has_numbers = bool(re.search(r'\d+%|\d+ percent|\$\d+|\d+ dollars', text.lower()))
    if not has_numbers:
        feedback["improvement_suggestions"].append("Add quantifiable achievements (e.g., 'Increased sales by 20%', 'Managed a team of 5 people').")
    
    # Overall assessment
    if len(feedback["improvement_suggestions"]) == 0:
        feedback["overall"].append("Your resume appears to be well-structured and includes most key components.")
    elif len(feedback["improvement_suggestions"]) >= 4:
        feedback["overall"].insert(0, "Your resume could benefit from several improvements.")
    else:
        feedback["overall"].insert(0, "Your resume is good but has room for improvement in a few areas.")
    
    return feedback

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_resume():
    if 'resume' not in request.files:
        return jsonify({'error': 'No file part'}), 400
    
    file = request.files['resume']
    
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400
    
    if file and allowed_file(file.filename):
        # Generate unique filename
        unique_filename = f"{uuid.uuid4().hex}_{file.filename}"
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_filename)
        file.save(file_path)
        
        # Extract text from file
        resume_text = extract_text_from_file(file_path)
        
        # Analyze resume
        feedback = analyze_resume(resume_text)
        
        # Save to database
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        cur.execute(
            "INSERT INTO resumes (filename, original_filename, content, feedback, created_at) VALUES (%s, %s, %s, %s, %s) RETURNING id",
            (unique_filename, file.filename, resume_text, str(feedback), datetime.now())
        )
        
        result = cur.fetchone()
        resume_id = result['id']
        
        cur.close()
        conn.close()
        
        return jsonify({
            'id': resume_id,
            'filename': file.filename,
            'feedback': feedback
        })
    
    return jsonify({'error': 'File type not allowed'}), 400

@app.route('/resumes/<int:resume_id>')
def get_resume(resume_id):
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT * FROM resumes WHERE id = %s", (resume_id,))
    resume = cur.fetchone()
    
    cur.close()
    conn.close()
    
    if resume:
        return jsonify(resume)
    
    return jsonify({'error': 'Resume not found'}), 404

@app.route('/uploads/<filename>')
def uploaded_file(filename):
    return send_from_directory(app.config['UPLOAD_FOLDER'], filename)

@app.route('/history')
def history():
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT id, original_filename, created_at FROM resumes ORDER BY created_at DESC LIMIT 10")
    resumes = cur.fetchall()
    
    cur.close()
    conn.close()
    
    return render_template('history.html', resumes=resumes)

if __name__ == '__main__':
    app.run(debug=True)