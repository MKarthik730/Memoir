from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
app=FastAPI()
app.mount("/homepage",StaticFiles(directory="frontend"), name="home_page")
@app.get('/home')
def home():
    return FileResponse("frontend/index.html")
@app.get("/login")
def login():
    return {"msg":"this is login screen"}