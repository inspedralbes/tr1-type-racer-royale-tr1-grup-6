# 🚀 AtomicSyntax 🚀

> Un joc de mecanografia multijugador on la velocitat i la precisió et portaran a la victòria. Competeix contra altres jugadors en una cursa per veure qui és el mestre del teclat!

---

## 📜 **Descripció del Projecte**

**AtomicSyntax** és un joc de mecanografia en temps real inspirat en el clàssic TypeRacer. Els jugadors s'uneixen a una sala i competeixen per teclejar paraules que apareixen a la pantalla. L'últim jugador que queda en peu guanya la partida.

El projecte està construït amb una arquitectura moderna:

- **Backend**: **Node.js** amb **Socket.IO** per a la gestió de la lògica del joc en temps real.
- **Frontend**: **Vue.js** per a una experiència d'usuari interactiva i dinàmica.

---

## 🧑‍💻 **Equip de Desenvolupament**

- Brian Briones
- Amin Oulad
- Iker Delgado
- David Quispe
- Adrian Maciel

---

## 🛠️ **Eines i Gestió**

- **Kanban Board**: Seguiment del projecte a [**Taiga**](https://tree.taiga.io/project/ikerdelgado-tr1-type-racer-royale-grup6/backlog).
- **Prototips de Disseny**: Disseny de la interfície a [**Penpot**](https://design.penpot.app/#/workspace?team-id=c04641ea-355e-80b8-8004-fdaf03527eef&file-id=5b786374-066f-8104-8007-048a191604dd&page-id=5b786374-066f-8104-8007-048a191604de).

---

## 🌐 **URL de Producció**

L'aplicació està desplegada i accessible a:

> [http://atomicsyntax.daw.inspedralbes.cat](http://atomicsyntax.daw.inspedralbes.cat)

---

## 🐳 **Com Executar amb Docker**

Aquest projecte utilitza **Docker** i **Docker Compose** per simplificar la configuració i el desplegament.

### Entorn de Desenvolupament

Per a un entorn de desenvolupament local amb _hot-reloading_:

```bash
# Aixeca els serveis en segon pla i reconstrueix les imatges
docker-compose -f docker-compose.dev.yml up -d --build
```

- Frontend (Vue.js) disponible a `http://localhost:5173`.
- Backend (Node.js) disponible a `http://localhost:3000`.

### Entorn de Producció

Per simular un entorn de producció amb Nginx com a servidor intermediari:

```bash
# Aixeca els serveis en mode producció
docker-compose -f docker-compose.prod.yml up -d --build
```

- L'aplicació completa estarà disponible a `http://atomicsyntax.daw.inspedralbes.cat` (o el domini configurat).

---

## 🎯 **Visió del Projecte i MVPs**

### **MVP 1 (Sprint 1): Requisits Mínims**

- **Objectiu**: Aconseguir un cicle de joc complet i funcional.
- **Funcionalitats Clau**:
  - 🎮 Sala global única (crear, unir-se, jugar).
  - 📝 Lògica bàsica del joc: els jugadors reben paraules i competeixen.
  - 🏆 Condició de victòria: es declara un guanyador.
  - 🔌 Comunicació bàsica Client-Servidor via WebSockets.
  - 📊 Estadístiques visuals bàsiques (progrés, velocitat).

### **MVP 2 (Sprint 2): Funcionalitats Addicionals**

- **Objectiu**: Millorar l'experiència de joc amb noves característiques.
- **Funcionalitats Clau**:
  - 🔥 Implementació de modes de joc addicionals (ex: Mort Súbita).
  - 💣 Sistema de penalitzacions: completar paraules envia dificultats als oponents.
  - ✨ Millores en la interfície d'usuari (UX/UI) i feedback visual.

### **MVP 3 (Sprint 3): Producció i Estabilitat**

- **Objectiu**: Assegurar que l'aplicació sigui estable i estigui llesta per a producció.
- **Tasques Clau**:
  - ⚙️ Configuració final de l'entorn de producció amb Docker.
  - 🚀 Desplegament continu de l'aplicació.
  - 🧪 Proves de rendiment i estabilitat.
  - 🐞 Correcció d'errors finals i poliment general.

### **Stretch Goal ✨**

> Implementació de **sales de joc personalitzades**. Això permetria als jugadors crear les seves pròpies sales amb configuracions específiques (nombre de jugadors, dificultat, mode de joc), en lloc de dependre d'una única sala global.

---

## 🎨 **Disseny (UX/UI)**

### **Diagrama de Flux d'Usuari**

> _(Aquí s'hauria d'inserir el diagrama de flux que mostra la navegació de l'usuari, des que entra a l'aplicació fins que acaba una partida)._

### **Esbossos de Pantalla (Wireframes)**

> _(En aquesta secció s'haurien d'afegir les imatges dels wireframes de les diferents pantalles: lobby, partida, resultats, etc.)._

---

## 🏗️ **Arquitectura**

### **Diagrama del Sistema (Docker)**

El sistema es compon de tres contenidors principals orquestrats amb **Docker Compose**:

1.  **`frontend`**: Un contenidor amb **Vue.js** que serveix la interfície d'usuari.
2.  **`backend`**: Un contenidor amb **Node.js** i **Socket.IO** que actua com a àrbitre del joc.
3.  **`nginx`**: (Només en producció) Un servidor intermediari que dirigeix el trànsit al frontend i al backend de manera eficient.

> _(Aquí s'hauria d'incloure un diagrama visual que representi com interactuen aquests contenidors)._

### **Protocol de Comunicació (Client-Servidor)**

La comunicació es realitza mitjançant esdeveniments de **Socket.IO**:

#### **Client → Servidor:**

- `client:ready`: El client notifica que està a punt per començar la partida.
- `client:word_completed`: El client informa que ha completat una paraula amb èxit.

#### **Servidor → Client:**

- `server:game_start`: El servidor anuncia l'inici de la partida a tots els clients.
- `server:game_state_update`: El servidor envia periòdicament l'estat actualitzat de tots els jugadors (progrés, posició, etc.).
- `server:new_word`: El servidor envia una nova paraula al client.
- `server:add_penalty`: El servidor ordena a un client que afegeixi una paraula de penalització.
- `server:game_over`: El servidor declara el final de la partida i anuncia el guanyador.
