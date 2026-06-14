import subprocess
import time

urls = [
    "https://highview.org",
    "https://childrenandnature.org",
    "https://ctu.edu.vn",
    "https://digitalpromise.org",
    "https://giaoducthoidai.vn",
    "https://hcm.edu.vn",
    "https://ieeexplore.ieee.org",
    "https://lamdong.gov.vn",
    "https://libretexts.org",
    "https://montessori-action.org"
]

notebook_id = "08156314-4205-4610-b599-918301a115f6"

def add_urls():
    for url in urls:
        print(f"Adding {url}...")
        try:
            result = subprocess.run(
                ["nlm", "source", "add", notebook_id, "--url", url],
                capture_output=True,
                text=True,
                encoding="utf-8"
            )
            if result.returncode == 0:
                print(f"✅ Successfully added: {url}")
            else:
                # Even if it crashed on success print, it might have added it
                if "Error" in result.stderr and "API error" in result.stderr:
                    print(f"❌ Failed to add: {url} - {result.stderr}")
                else:
                    print(f"⚠️ Added but crashed on output: {url}")
        except Exception as e:
            print(f"Error: {e}")
        time.sleep(2) # Be nice to the API

if __name__ == "__main__":
    add_urls()
