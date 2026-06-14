import subprocess
import sys

def get_notebooks():
    env = {"PYTHONIOENCODING": "utf-8"}
    try:
        # Run nlm notebook list and capture output
        result = subprocess.run(
            ["nlm", "notebook", "list"],
            capture_output=True,
            text=True,
            encoding="utf-8",
            env=env
        )
        print("STDOUT:")
        print(result.stdout)
        print("STDERR:")
        print(result.stderr)
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    get_notebooks()
