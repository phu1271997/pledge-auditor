# v0.2.16
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }
from genlayer import *


# Minimal sanity contract. Deploy this FIRST on a fresh Studio environment
# (Settings → Reset Storage → Hard refresh) to confirm the runtime works
# before deploying the main Pledge Auditor contract.
class Contract(gl.Contract):
    counter: u256
    note: str

    def __init__(self):
        self.counter = u256(0)
        self.note = "ok"

    @gl.public.write
    def bump(self) -> None:
        self.counter = u256(self.counter + u256(1))

    @gl.public.view
    def get(self) -> str:
        return f"{int(self.counter)}:{self.note}"
