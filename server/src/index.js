import dotenv from 'dotenv'
import connectDB from './DB/index.js'
import { app } from './app.js'
import { fileURLToPath } from 'url'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))

dotenv.config({
    path: envPath
})


connectDB()
.then(() => {
    const port = process.env.PORT || 8000
    app.listen(port, () => {
        console.log(`⚙️ Server is running at port : ${port}`);
    })
})
.catch((err) => {
    console.log("MONGO db connection failed !!! ", err);
})
