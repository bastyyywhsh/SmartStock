require("dotenv").config();
const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const pool = require("./db");

const app = express();

const JWT_SECRET = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());

// ===============================
// JWT AUTHENTICATION
// ===============================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "Access denied. Token missing.",
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({
        error: "Invalid or expired token.",
      });
    }

    req.user = user;
    next();
  });
};

// ===============================
// ADMIN AUTHORIZATION
// ===============================

const requireAdmin = (req, res, next) => {
  if (req.user && req.user.role === "admin") {
    next();
  } else {
    return res.status(403).json({
      error: "Access denied. Admin rights required.",
    });
  }
};

// ===============================
// REGISTER
// ===============================

app.post("/api/auth/register", async (req, res) => {
  try {
    const { username, password, role } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Please enter username and password",
      });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'staff'
      )
    `);

    const existingUser = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({
        error: "Username already taken",
      });
    }

    const userRole = role === "admin" ? "admin" : "staff";

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await pool.query(
      `INSERT INTO users (username, password, role)
       VALUES ($1, $2, $3)
       RETURNING id, username, role`,
      [username, hashedPassword, userRole]
    );

    const user = newUser.rows[0];

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: user.role,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      message: "Registration successful",
      token,
      user,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

// ===============================
// LOGIN
// ===============================

app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Please enter username and password",
      });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(100) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role VARCHAR(20) DEFAULT 'staff'
      )
    `);

    const result = await pool.query(
      "SELECT * FROM users WHERE username = $1",
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const user = result.rows[0];

    const passwordMatch = await bcrypt.compare(
      password,
      user.password
    );

    if (!passwordMatch) {
      return res.status(401).json({
        error: "Invalid username or password",
      });
    }

    const role = user.role || "staff";

    const token = jwt.sign(
      {
        id: user.id,
        username: user.username,
        role: role,
      },
      JWT_SECRET,
      { expiresIn: "8h" }
    );

    res.json({
      message: "Login successful",
      token,
      user: {
        id: user.id,
        username: user.username,
        role: role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

// ===============================
// TEST AUTHENTICATION
// ===============================

app.get("/api/auth/me", authenticateToken, (req, res) => {
  res.json({
    message: "You are authenticated",
    user: req.user,
  });
});

// ===============================
// PRODUCTS
// ===============================

app.get("/api/products", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM products ORDER BY id ASC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

app.post("/api/products", authenticateToken, async (req, res) => {
  try {
    const { name, category, price, stock } = req.body;

    const result = await pool.query(
      `INSERT INTO products (name, category, price, stock)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, category, price, stock]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

app.put("/api/products/:id", authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, category, price, stock } = req.body;

    const result = await pool.query(
      `UPDATE products
       SET name = $1,
           category = $2,
           price = $3,
           stock = $4
       WHERE id = $5
       RETURNING *`,
      [name, category, price, stock, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

app.delete(
  "/api/products/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      await pool.query(
        "DELETE FROM products WHERE id = $1",
        [id]
      );

      res.json({
        message: "Product deleted successfully",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ===============================
// SALES
// ===============================

app.get("/api/sales", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        sales.id,
        sales.product_id,
        products.name AS product_name,
        sales.quantity_sold,
        sales.total_price,
        sales.created_at
      FROM sales
      JOIN products
        ON sales.product_id = products.id
      ORDER BY sales.created_at DESC
    `);

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

app.post("/api/sales", authenticateToken, async (req, res) => {
  try {
    const {
      product_id,
      quantity_sold,
      total_price,
    } = req.body;

    const product = await pool.query(
      "SELECT stock FROM products WHERE id = $1",
      [product_id]
    );

    if (product.rows.length === 0) {
      return res.status(404).json({
        error: "Product not found",
      });
    }

    if (product.rows[0].stock < quantity_sold) {
      return res.status(400).json({
        error: "Insufficient stock available",
      });
    }

    const sale = await pool.query(
      `INSERT INTO sales
       (product_id, quantity_sold, total_price)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [product_id, quantity_sold, total_price]
    );

    await pool.query(
      `UPDATE products
       SET stock = stock - $1
       WHERE id = $2`,
      [quantity_sold, product_id]
    );

    res.json(sale.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

// ===============================
// CUSTOMERS
// ===============================

app.get("/api/customers", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM customers ORDER BY id DESC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

app.post("/api/customers", authenticateToken, async (req, res) => {
  try {
    const { name, email, phone } = req.body;

    const result = await pool.query(
      `INSERT INTO customers (name, email, phone)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, email, phone]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

app.delete(
  "/api/customers/:id",
  authenticateToken,
  requireAdmin,
  async (req, res) => {
    try {
      const { id } = req.params;

      await pool.query(
        "DELETE FROM customers WHERE id = $1",
        [id]
      );

      res.json({
        message: "Customer deleted successfully",
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({
        error: "Server error",
      });
    }
  }
);

// ===============================
// ADMIN USER MANAGEMENT
// ===============================

// Get all users - ADMIN ONLY
app.get("/api/users", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, username, role FROM users ORDER BY id ASC"
    );

    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

// Change user role - ADMIN ONLY
app.put("/api/users/:id/role", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!["admin", "staff"].includes(role)) {
      return res.status(400).json({
        error: "Role must be admin or staff",
      });
    }

    const result = await pool.query(
      `UPDATE users
       SET role = $1
       WHERE id = $2
       RETURNING id, username, role`,
      [role, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

// Delete user - ADMIN ONLY
app.delete("/api/users/:id", authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Prevent admin from deleting their own account
    if (Number(id) === Number(req.user.id)) {
      return res.status(400).json({
        error: "You cannot delete your own account",
      });
    }

    const result = await pool.query(
      "DELETE FROM users WHERE id = $1 RETURNING id, username",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    res.json({
      message: "User deleted successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Server error",
    });
  }
});

// ===============================
// SERVER
// ===============================

const PORT = 5000;

app.listen(PORT, () => {
  console.log(
    `SmartLock backend running on http://localhost:${PORT}`
  );
});