import cv2
import pytesseract
import numpy as np
import re
import os
from pdf2image import convert_from_path

# ---------------- LOAD IMAGE OR PDF ----------------
def load_input(file_path):
    ext = os.path.splitext(file_path)[1].lower()

    if ext == ".pdf":
        pages = convert_from_path(file_path)
        images = []

        for i, page in enumerate(pages):
            img = np.array(page)
            img = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
            images.append(img)

        return images  # list of images

    else:
        img = cv2.imread(file_path)
        if img is None:
            raise ValueError("Invalid file path or unsupported format")
        return [img]  # single image as list


# ---------------- IMAGE PREPROCESS ----------------
def preprocess_image(img):

    # Resize
    img = cv2.resize(img, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)

    # Grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Sharpen
    kernel = np.array([[0, -1, 0],
                       [-1, 5,-1],
                       [0, -1, 0]])
    sharp = cv2.filter2D(gray, -1, kernel)

    # Blur
    blur = cv2.GaussianBlur(sharp, (3, 3), 0)

    # Threshold
    thresh = cv2.adaptiveThreshold(
        blur, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        11, 2
    )

    return thresh


# ---------------- OCR ----------------
def extract_text(image):
    config = r'--oem 3 --psm 4'
    return pytesseract.image_to_string(image, config=config)


# ---------------- CLEAN TEXT ----------------
def clean_text(text):
    text = re.sub(r'[^a-zA-Z0-9.,:$₹()/\n -]', '', text)
    text = re.sub(r'\s+', ' ', text)

    # Fix common OCR mistakes
    text = text.replace("NewYork", "New York")
    text = text.replace("Aprescription", "A prescription")

    return text.strip()


# ---------------- EXTRACT FIELDS ----------------
def extract_fields(text):
    data = {}

    # Match ₹ or $
    amounts = re.findall(r'[₹$]\s?\d{1,3}(?:,\d{3})*(?:\.\d{2})?', text)

    normalized = []
    for amt in amounts:
        amt = amt.replace(" ", "")

        if '.' not in amt:
            amt += ".00"

        normalized.append(amt)

    data["amounts"] = list(set(normalized)) if normalized else []

    # Dates
    raw_dates = re.findall(r'\b\d{6}\b', text)
    formatted_dates = [f"{d[:2]}/{d[2:4]}/{d[4:]}" for d in raw_dates]

    normal_dates = re.findall(r'\d{2}/\d{2}/\d{2,4}', text)

    data["dates"] = list(set(formatted_dates + normal_dates))

    return data


# ---------------- MAIN FUNCTION ----------------
def process_file(file_path):
    """
    Works for both IMAGE and PDF
    """

    images = load_input(file_path)

    full_text = ""

    for img in images:
        processed = preprocess_image(img)
        raw = extract_text(processed)
        full_text += raw + "\n"

    clean = clean_text(full_text)
    fields = extract_fields(clean)

    return {
        "raw_text": full_text,
        "clean_text": clean,
        "fields": fields
    }
