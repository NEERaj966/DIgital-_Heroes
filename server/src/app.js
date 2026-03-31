import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { ApiResponse } from './utils/Apiresponse.js'
import { fileURLToPath } from 'url'



const app = express();
const corsOrigin = String(process.env.CORS_ORIGIN || '').trim()
const publicDir = fileURLToPath(new URL('../public/', import.meta.url))

app.use(cors({
    origin: corsOrigin === "*" ? true : (corsOrigin || true),
    credentials: true
}))

app.use(express.json({limit: "16kb"}))
app.use(express.urlencoded({extended: true, limit: "16kb"}))
// Serve static assets from the backend public folder
app.use(express.static(publicDir))
app.use(cookieParser())

import userRouter from './routes/User.routes.js'
import adminRouter from './routes/Admin.routes.js'

app.get("/health", (_, res) => {
    return res.status(200).json(
        new ApiResponse(200, { status: "ok", uptime: process.uptime() }, "Service healthy")
    )
})

app.use("/api/v1/users", userRouter)
app.use("/api/v1/admins", adminRouter)

app.use((_, res) => {
    return res.status(404).json(
        new ApiResponse(404, null, "Route not found")
    )
})

app.use((err, _, res, next) => {
    const statusCode = err?.statusCode || 500
    const message = err?.message || "Internal Server Error"

    if (res.headersSent) {
        return next(err)
    }

    return res.status(statusCode).json(
        new ApiResponse(statusCode, null, message)
    )
})

export{
    app
}
