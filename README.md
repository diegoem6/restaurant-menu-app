# 🍽️ Carta Digital — Gestor de Menús de Restaurante

Aplicación web cliente-servidor para crear y gestionar cartas de restaurantes.

## Stack Tecnológico

- **Backend**: Node.js + Express
- **Base de datos**: MongoDB + Mongoose
- **Frontend**: React + Vite + Tailwind CSS
- **Auth**: JWT + bcryptjs
- **Drag & Drop**: @dnd-kit

---

## Requisitos previos

- Node.js v18+
- MongoDB corriendo localmente (o una URI de MongoDB Atlas)

---

## Instalación y configuración

### 1. Clonar / descomprimir el proyecto

### 2. Configurar el servidor

```bash
cd server
cp .env.example .env
# Editá .env con tu URI de MongoDB y un secreto JWT
npm install
```

### 3. Inicializar la base de datos (crea el admin por defecto)

```bash
npm run init
# Usuario admin creado: admin / admin123
```

### 4. Iniciar el servidor

```bash
npm run dev       # desarrollo con nodemon
# o
npm start         # producción
```

El servidor corre en `http://localhost:5000`

### 5. Configurar el cliente

```bash
cd ../client
npm install
npm run dev
```

El cliente corre en `http://localhost:3000`

---

## Credenciales por defecto

| Usuario | Contraseña | Rol |
|---------|-----------|-----|
| admin   | admin123  | Administrador |

> ⚠️ **Cambiar la contraseña en producción**.

---

## Funcionalidades

### Roles
- **Administrador**: gestiona usuarios propietarios + todo lo demás
- **Propietario**: gestiona sus propias cartas, categorías y platos

### Platos (`/dishes`)
- Crear, editar y eliminar platos
- Precio en pesos uruguayos obligatorio
- Precio en dólares opcional (calculado automáticamente según tipo de cambio configurable)

### Categorías (`/categories`)
- Crear, editar y eliminar categorías
- Asignar platos a categorías con orden drag & drop

### Cartas (`/menus`)
- Crear cartas con nombre, fuente, fondo y logo
- 6 fondos preestablecidos + imagen personalizada
- 7 fuentes disponibles
- Editor de categorías con orden drag & drop (`/menus/:id/edit`)

### Impresión (`/menus/:id/print`)
- Vista de impresión completa
- Portada con logo y nombre
- Cada categoría en página nueva
- Respeta el orden configurado
- Botón "Imprimir" y CSS `@media print` incluido

---

## Estructura del proyecto

```
restaurant-menu-app/
├── server/
│   ├── models/          # Mongoose models
│   ├── routes/          # Express routes
│   ├── middleware/       # JWT auth middleware
│   ├── server.js        # Entry point
│   └── init.js          # DB initialization script
└── client/
    └── src/
        ├── pages/       # React pages
        ├── components/  # Shared components
        ├── context/     # Auth context
        └── api.js       # Axios instance
```

---

## Variables de entorno (server/.env)

```
MONGO_URI=mongodb://localhost:27017/restaurant_menus
JWT_SECRET=cambia_este_secreto_en_produccion
PORT=5000
ADMIN_USERNAME=admin
ADMIN_PASSWORD=admin123
```

---

## Producción

Para servir el cliente desde el servidor en producción:

```bash
cd client && npm run build
```

Luego configurar Express para servir la carpeta `client/dist` como archivos estáticos.
