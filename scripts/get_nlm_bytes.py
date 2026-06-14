import subprocess

def get_notebooks():
    try:
        # Run nlm notebook list and capture raw bytes
        result = subprocess.run(
            "nlm notebook list",
            shell=True,
            capture_output=True
        )
        print("STDOUT (hex):")
        print(result.stdout.hex())
        # Try to decode with a loose encoding
        print("STDOUT (decoded with latin-1):")
        print(result.stdout.decode('latin-1'))
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_notebooks()
