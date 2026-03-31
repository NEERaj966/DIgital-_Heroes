import dotenv from 'dotenv'
import { fileURLToPath } from 'url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))

dotenv.config({
    path: envPath
})

const [{ default: connectDB }, { app }] = await Promise.all([
    import('./DB/index.js'),
    import('./app.js')
])

try {
    await connectDB()

    const port = Number(process.env.PORT) || 8000

    app.listen(port, () => {
        console.log(`Server is running at port: ${port}`)
    })
} catch (err) {
    console.error("MongoDB connection failed during startup:", err.message)
    process.exit(1)
}
