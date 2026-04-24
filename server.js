const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const axios = require("axios");

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const FIREBASE_API_KEY = process.env.FIREBASE_API_KEY;

app.get("/", (req, res) => {
    res.send("API funcionando");
});

app.post("/login", async (req, res) => {
    const { email, password } = req.body;

    try {
        const response = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_API_KEY}`,
            {
                email,
                password,
                returnSecureToken: true
            }
        );

        res.json({
            token: response.data.idToken
        });

    } catch (error) {
        res.status(401).json({
            error: "Login inválido"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Rodando em http://localhost:${PORT}`);
});