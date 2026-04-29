import os
import uuid
from werkzeug.utils import secure_filename

# Folders
UPLOAD_FOLDER = "backend/uploads"
PROCESSED_FOLDER = "backend/processed"

# Allowed file types
ALLOWED_EXTENSIONS = {"png", "jpg", "jpeg", "pdf"}


# ---------------- CHECK EXTENSION ----------------
def allowed_file(filename):
    return "." in filename and filename.rsplit(".", 1)[1].lower() in ALLOWED_EXTENSIONS


# ---------------- CREATE FOLDERS ----------------
def ensure_directories():
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)
    os.makedirs(PROCESSED_FOLDER, exist_ok=True)


# ---------------- SAVE FILE ----------------
def save_file(file):
    """
    Saves uploaded file with a unique name
    Returns file metadata
    """

    if file.filename == "":
        raise ValueError("No file selected")

    if not allowed_file(file.filename):
        raise ValueError("File type not allowed")

    # Clean filename
    original_name = secure_filename(file.filename)

    # Generate unique filename
    ext = original_name.rsplit(".", 1)[1].lower()
    unique_name = f"{uuid.uuid4().hex}.{ext}"

    file_path = os.path.join(UPLOAD_FOLDER, unique_name)

    # Save file
    file.save(file_path)

    return {
        "original_name": original_name,
        "stored_name": unique_name,
        "file_type": ext,
        "path": file_path
    }


# ---------------- GET FILE PATH ----------------
def get_file_path(filename):
    return os.path.join(UPLOAD_FOLDER, filename)


# ---------------- DELETE FILE ----------------
def delete_file(filename):
    path = get_file_path(filename)

    if os.path.exists(path):
        os.remove(path)
        return True

    return False
