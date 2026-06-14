import re

def extract_urls(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Simple regex to find URLs
    urls = re.findall(r'http[s]?://(?:[a-zA-Z]|[0-9]|[$-_@.&+]|[!*\\(\\),]|(?:%[0-9a-fA-F][0-9a-fA-F]))+', content)
    
    # Unique and filter out some known internal links if any
    unique_urls = sorted(list(set(urls)))
    
    # Print in a way that I can easily parse
    for url in unique_urls:
        print(url)

if __name__ == "__main__":
    # Use direct absolute path
    extract_urls(r"C:\Users\PC\.gemini\antigravity\brain\e7402f0d-dbe5-4640-80cb-c88378e05f8c\bao_cao_nghien_cuu.md")
