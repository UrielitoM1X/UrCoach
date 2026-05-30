from fastapi import FastAPI, Request, Form
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

@app.get("/", response_class=HTMLResponse)
def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

# --- NUEVA RUTA: RECIBIR MÉTRICAS DEL ENTRENAMIENTO ---
@app.post("/guardar-entrenamiento", response_class=HTMLResponse)
async def guardar_entrenamiento(
    request: Request, 
    reps: int = Form(...), 
    ratio: float = Form(...), 
    tipo_palanca: str = Form(...)
):
    # Aquí en el futuro conectarás tu ORM (PostgreSQL) para hacer un:
    # db.guardar(reps, ratio, tipo_palanca)
    
    # Creamos la respuesta usando la sintaxis nativa de Turbo Streams de Hotwire
    # Esto le dice al navegador: "Busca el elemento con id 'historial' y reemplaza su contenido"
    html_content = f"""
    <turbo-stream action="replace" target="historial">
        <template>
            <div id="historial" class="bg-zinc-800/80 p-4 rounded-xl border border-emerald-500/30 mt-6 animate-pulse">
                <h3 class="text-emerald-400 font-bold text-lg mb-2">📊 Resumen de la Última Serie</h3>
                <ul class="text-sm space-y-1 text-zinc-300">
                    <li><strong>Repeticiones Válidas:</strong> {reps}</li>
                    <li><strong>Ratio de Palancas:</strong> {ratio}</li>
                    <li><strong>Diagnóstico Biomecánico:</strong> {tipo_palanca}</li>
                </ul>
                <p class="text-xs text-zinc-500 mt-2">✓ Guardado en el servidor exitosamente</p>
            </div>
        </template>
    </turbo-stream>
    """
    return HTMLResponse(content=html_content)