import React, { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import "./App.css";

interface Product {
  id: number;
  name: string;
  category: string;
  price: number;
  stock: number;
}

interface Sale {
  id: number;
  product_name: string;
  quantity: number;
  total_price: number;
  customer_name: string;
  sale_date: string;
}

interface Customer {
  id: number;
  name: string;
  email: string;
  phone: string;
}

interface User {
  username: string;
  role: string;
}

const API_URL = "http://localhost:5000";

export default function App() {
  const [user, setUser] = useState<User | null>(null);

  const [isLogin, setIsLogin] = useState(true);
  const [usernameInput, setUsernameInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [roleInput, setRoleInput] = useState("staff");

  const [activeTab, setActiveTab] = useState("dashboard");

  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([
    {
      id: 1,
      name: "John Doe",
      email: "john@example.com",
      phone: "09123456789",
    },
  ]);

  const [loadingProducts, setLoadingProducts] = useState(false);

  // Product form
  const [productName, setProductName] = useState("");
  const [productCategory, setProductCategory] =
    useState("Electronics");
  const [productPrice, setProductPrice] = useState("");
  const [productStock, setProductStock] = useState("");
  const [editingProduct, setEditingProduct] =
    useState<Product | null>(null);

  // Sales form
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [saleCustomerName, setSaleCustomerName] = useState("");

  // Customer form
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");

  // Search/filter
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  // --------------------------------------------------
  // LOAD SAVED USER
  // --------------------------------------------------

  useEffect(() => {
    const savedUser = localStorage.getItem("user");

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser);
        setUser(parsedUser);
      } catch {
        localStorage.removeItem("user");
        localStorage.removeItem("token");
      }
    }
  }, []);

  // --------------------------------------------------
  // AUTH HEADERS
  // --------------------------------------------------

  const getAuthHeaders = () => {
    const token = localStorage.getItem("token");

    return {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    };
  };

  // --------------------------------------------------
  // LOAD PRODUCTS
  // --------------------------------------------------

  const loadProducts = async () => {
    const token = localStorage.getItem("token");

    if (!token) {
      return;
    }

    setLoadingProducts(true);

    try {
      const response = await fetch(`${API_URL}/api/products`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.status === 401) {
        alert("Your login session expired. Please login again.");

        localStorage.removeItem("token");
        localStorage.removeItem("user");
        setUser(null);

        return;
      }

      const data = await response.json();

      if (!response.ok) {
        console.error("Failed to load products:", data);
        alert(data.error || "Failed to load products.");
        return;
      }

      setProducts(data);
    } catch (error) {
      console.error("Load products error:", error);
      alert(
        "Cannot connect to backend. Make sure your backend server is running."
      );
    } finally {
      setLoadingProducts(false);
    }
  };

  useEffect(() => {
    if (user) {
      loadProducts();
    }
  }, [user]);

  // --------------------------------------------------
  // LOGIN / REGISTER
  // --------------------------------------------------

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const endpoint = isLogin
        ? `${API_URL}/api/auth/login`
        : `${API_URL}/api/auth/register`;

      const body = isLogin
        ? {
            username: usernameInput,
            password: passwordInput,
          }
        : {
            username: usernameInput,
            password: passwordInput,
            role: roleInput,
          };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Authentication failed.");
        return;
      }

      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user));

      setUser(data.user);

      setUsernameInput("");
      setPasswordInput("");
    } catch (error) {
      console.error(error);
      alert(
        "Cannot connect to backend. Make sure the backend is running."
      );
    }
  };

  // --------------------------------------------------
  // LOGOUT
  // --------------------------------------------------

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    setUser(null);
    setProducts([]);
    setActiveTab("dashboard");
  };

  // --------------------------------------------------
  // SAVE PRODUCT
  // --------------------------------------------------

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!productName || !productPrice || !productStock) {
      alert("Please complete all product fields.");
      return;
    }

    const productData = {
      name: productName,
      category: productCategory,
      price: Number(productPrice),
      stock: Number(productStock),
    };

    try {
      let response;

      if (editingProduct) {
        response = await fetch(
          `${API_URL}/api/products/${editingProduct.id}`,
          {
            method: "PUT",
            headers: getAuthHeaders(),
            body: JSON.stringify(productData),
          }
        );
      } else {
        response = await fetch(`${API_URL}/api/products`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(productData),
        });
      }

      if (response.status === 401) {
        alert("Your login session expired. Please login again.");
        handleLogout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        alert(
          data.error ||
            (editingProduct
              ? "Failed to update product."
              : "Failed to add product.")
        );
        return;
      }

      if (editingProduct) {
        setProducts((currentProducts) =>
          currentProducts.map((product) =>
            product.id === editingProduct.id ? data : product
          )
        );
      } else {
        setProducts((currentProducts) => [
          ...currentProducts,
          data,
        ]);
      }

      clearProductForm();
    } catch (error) {
      console.error("Product error:", error);

      alert(
        "Cannot connect to backend. Make sure the backend server is running on port 5000."
      );
    }
  };

  // --------------------------------------------------
  // CLEAR PRODUCT FORM
  // --------------------------------------------------

  const clearProductForm = () => {
    setProductName("");
    setProductCategory("Electronics");
    setProductPrice("");
    setProductStock("");
    setEditingProduct(null);
  };

  // --------------------------------------------------
  // EDIT PRODUCT
  // --------------------------------------------------

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setProductName(product.name);
    setProductCategory(product.category);
    setProductPrice(product.price.toString());
    setProductStock(product.stock.toString());

    setActiveTab("products");
  };

  // --------------------------------------------------
  // DELETE PRODUCT
  // --------------------------------------------------

  const handleDeleteProduct = async (id: number) => {
    if (user?.role !== "admin") {
      alert("Only administrators can delete products.");
      return;
    }

    const confirmed = window.confirm(
      "Are you sure you want to delete this product?"
    );

    if (!confirmed) {
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/api/products/${id}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );

      if (response.status === 401) {
        alert("Your login session expired. Please login again.");
        handleLogout();
        return;
      }

      const data = await response.json();

      if (!response.ok) {
        alert(data.error || "Failed to delete product.");
        return;
      }

      setProducts((currentProducts) =>
        currentProducts.filter((product) => product.id !== id)
      );
    } catch (error) {
      console.error(error);
      alert("Cannot connect to backend.");
    }
  };

  // --------------------------------------------------
  // RECORD SALE
  // --------------------------------------------------

  const handleRecordSale = (e: React.FormEvent) => {
    e.preventDefault();

    const product = products.find(
      (p) => p.id === Number(selectedProductId)
    );

    const quantity = Number(saleQuantity);

    if (!product) {
      alert("Please select a product.");
      return;
    }

    if (quantity <= 0) {
      alert("Quantity must be greater than zero.");
      return;
    }

    if (product.stock < quantity) {
      alert("Insufficient stock.");
      return;
    }

    const total = product.price * quantity;

    const newSale: Sale = {
      id: Date.now(),
      product_name: product.name,
      quantity: quantity,
      total_price: total,
      customer_name: saleCustomerName || "Guest",
      sale_date: new Date().toLocaleString(),
    };

    setSales((currentSales) => [
      newSale,
      ...currentSales,
    ]);

    setProducts((currentProducts) =>
      currentProducts.map((p) =>
        p.id === product.id
          ? {
              ...p,
              stock: p.stock - quantity,
            }
          : p
      )
    );

    setSelectedProductId("");
    setSaleQuantity("1");
    setSaleCustomerName("");

    alert("Sale recorded successfully!");
  };

  // --------------------------------------------------
  // ADD CUSTOMER
  // --------------------------------------------------

  const handleAddCustomer = (e: React.FormEvent) => {
    e.preventDefault();

    const newCustomer: Customer = {
      id: Date.now(),
      name: customerName,
      email: customerEmail,
      phone: customerPhone,
    };

    setCustomers((currentCustomers) => [
      ...currentCustomers,
      newCustomer,
    ]);

    setCustomerName("");
    setCustomerEmail("");
    setCustomerPhone("");

    alert("Customer added successfully!");
  };

  // --------------------------------------------------
  // PDF REPORT
  // --------------------------------------------------

  const exportPDF = () => {
    const doc = new jsPDF();

    doc.text("SmartStock - Sales Report", 14, 15);

    autoTable(doc, {
      startY: 25,
      head: [
        [
          "ID",
          "Product",
          "Qty",
          "Total",
          "Customer",
          "Date",
        ],
      ],
      body: sales.map((sale) => [
        sale.id,
        sale.product_name,
        sale.quantity,
        `PHP ${sale.total_price.toFixed(2)}`,
        sale.customer_name,
        sale.sale_date,
      ]),
    });

    doc.save("SmartStock_Sales_Report.pdf");
  };

  // --------------------------------------------------
  // DASHBOARD DATA
  // --------------------------------------------------

  const lowStockItems = products.filter(
    (product) => product.stock < 5
  );

  const totalSalesAmount = sales.reduce(
    (sum, sale) => sum + sale.total_price,
    0
  );

  const filteredProducts = products.filter(
    (product) =>
      product.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) &&
      (filterCategory === "All" ||
        product.category === filterCategory)
  );

  const COLORS = [
    "#3b82f6",
    "#10b981",
    "#a855f7",
    "#f59e0b",
  ];

  // --------------------------------------------------
  // LOGIN SCREEN
  // --------------------------------------------------

  if (!user) {
    return (
      <div className="auth-container">
        <div className="auth-card">
          <h2>
            {isLogin
              ? "SmartStock Login"
              : "Register Account"}
          </h2>

          <form onSubmit={handleAuth}>
            <input
              type="text"
              placeholder="Username"
              required
              value={usernameInput}
              onChange={(e) =>
                setUsernameInput(e.target.value)
              }
            />

            <input
              type="password"
              placeholder="Password"
              required
              value={passwordInput}
              onChange={(e) =>
                setPasswordInput(e.target.value)
              }
            />

            {!isLogin && (
              <select
                value={roleInput}
                onChange={(e) =>
                  setRoleInput(e.target.value)
                }
              >
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </select>
            )}

            <button type="submit">
              {isLogin ? "Login" : "Register"}
            </button>
          </form>

          <div
            className="toggle-auth"
            onClick={() => setIsLogin(!isLogin)}
          >
            {isLogin
              ? "Need an account? Register"
              : "Already have an account? Login"}
          </div>
        </div>
      </div>
    );
  }

  // --------------------------------------------------
  // MAIN APPLICATION
  // --------------------------------------------------

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div>
          <h2>SmartStock</h2>

          <nav>
            <button
              className={
                activeTab === "dashboard"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab("dashboard")
              }
            >
              Dashboard
            </button>

            <button
              className={
                activeTab === "products"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab("products")
              }
            >
              Products
            </button>

            <button
              className={
                activeTab === "sales"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab("sales")
              }
            >
              Sales
            </button>

            <button
              className={
                activeTab === "customers"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab("customers")
              }
            >
              Customers
            </button>

            <button
              className={
                activeTab === "reports"
                  ? "active"
                  : ""
              }
              onClick={() =>
                setActiveTab("reports")
              }
            >
              Reports
            </button>
          </nav>
        </div>

        <div>
          <p className="welcome-text">
            {user.username}{" "}
            <span className="role-badge">
              {user.role}
            </span>
          </p>

          <button
            className="logout-btn"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </aside>

      <main className="main-content">

        {/* DASHBOARD */}

        {activeTab === "dashboard" && (
          <div>
            <h1>Dashboard</h1>

            {lowStockItems.length > 0 && (
              <div className="alert-banner">
                ⚠️{" "}
                <strong>
                  Low Stock Warning:
                </strong>{" "}
                {lowStockItems.length} product(s)
                have less than 5 items in stock.
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-card">
                <h3>Total Products</h3>
                <div className="stat-value">
                  {products.length}
                </div>
              </div>

              <div className="stat-card">
                <h3>Total Revenue</h3>
                <div className="stat-value">
                  ₱{totalSalesAmount.toFixed(2)}
                </div>
              </div>

              <div className="stat-card">
                <h3>Low Stock Items</h3>
                <div className="stat-value">
                  {lowStockItems.length}
                </div>
              </div>
            </div>

            <div className="charts-container">
              <div className="chart-card">
                <h3>
                  Inventory Stock Levels
                </h3>

                <ResponsiveContainer
                  width="100%"
                  height={250}
                >
                  <BarChart data={products}>
                    <XAxis
                      dataKey="name"
                    />
                    <YAxis />
                    <Tooltip />

                    <Bar
                      dataKey="stock"
                      fill="#3b82f6"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="chart-card">
                <h3>
                  Product Stock Distribution
                </h3>

                <ResponsiveContainer
                  width="100%"
                  height={250}
                >
                  <PieChart>
                    <Pie
                      data={products}
                      dataKey="stock"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                    >
                      {products.map(
                        (_, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              COLORS[
                                index %
                                  COLORS.length
                              ]
                            }
                          />
                        )
                      )}
                    </Pie>

                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}

        {activeTab === "products" && (
          <div>
            <h1>
              Inventory Management
            </h1>

            <div className="card">
              <h2>
                {editingProduct
                  ? "Edit Product"
                  : "Add New Product"}
              </h2>

              <form
                onSubmit={handleSaveProduct}
                className="form-grid"
              >
                <input
                  type="text"
                  placeholder="Product Name"
                  required
                  value={productName}
                  onChange={(e) =>
                    setProductName(
                      e.target.value
                    )
                  }
                />

                <select
                  value={productCategory}
                  onChange={(e) =>
                    setProductCategory(
                      e.target.value
                    )
                  }
                >
                  <option value="Electronics">
                    Electronics
                  </option>

                  <option value="Accessories">
                    Accessories
                  </option>

                  <option value="Office">
                    Office
                  </option>
                </select>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="Price (PHP)"
                  required
                  value={productPrice}
                  onChange={(e) =>
                    setProductPrice(
                      e.target.value
                    )
                  }
                />

                <input
                  type="number"
                  min="0"
                  placeholder="Stock"
                  required
                  value={productStock}
                  onChange={(e) =>
                    setProductStock(
                      e.target.value
                    )
                  }
                />

                <button type="submit">
                  {editingProduct
                    ? "Update Product"
                    : "Add Product"}
                </button>

                {editingProduct && (
                  <button
                    type="button"
                    onClick={
                      clearProductForm
                    }
                  >
                    Cancel
                  </button>
                )}
              </form>
            </div>

            <div className="filter-bar">
              <input
                type="text"
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) =>
                  setSearchTerm(
                    e.target.value
                  )
                }
              />

              <select
                value={filterCategory}
                onChange={(e) =>
                  setFilterCategory(
                    e.target.value
                  )
                }
              >
                <option value="All">
                  All Categories
                </option>

                <option value="Electronics">
                  Electronics
                </option>

                <option value="Accessories">
                  Accessories
                </option>

                <option value="Office">
                  Office
                </option>
              </select>

              <button
                type="button"
                onClick={loadProducts}
              >
                Refresh
              </button>
            </div>

            {loadingProducts ? (
              <p>Loading products...</p>
            ) : filteredProducts.length === 0 ? (
              <div className="card">
                <h3>No products found.</h3>
                <p>
                  Add a product using the form
                  above.
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Stock</th>
                    <th>Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.map(
                    (product) => (
                      <tr key={product.id}>
                        <td>
                          {product.name}
                        </td>

                        <td>
                          {product.category}
                        </td>

                        <td>
                          ₱
                          {Number(
                            product.price
                          ).toFixed(2)}
                        </td>

                        <td>
                          {product.stock}
                        </td>

                        <td>
                          <button
                            className="edit-btn"
                            onClick={() =>
                              handleEditProduct(
                                product
                              )
                            }
                          >
                            Edit
                          </button>

                          {user.role ===
                            "admin" && (
                            <button
                              className="delete-btn"
                              onClick={() =>
                                handleDeleteProduct(
                                  product.id
                                )
                              }
                            >
                              Delete
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* SALES */}

        {activeTab === "sales" && (
          <div>
            <h1>Record Sales</h1>

            <div className="card">
              <h2>
                New Sale Transaction
              </h2>

              <form
                onSubmit={handleRecordSale}
                className="form-grid"
              >
                <select
                  required
                  value={
                    selectedProductId
                  }
                  onChange={(e) =>
                    setSelectedProductId(
                      e.target.value
                    )
                  }
                >
                  <option value="">
                    Select Product...
                  </option>

                  {products.map(
                    (product) => (
                      <option
                        key={product.id}
                        value={product.id}
                      >
                        {product.name}{" "}
                        (Stock:{" "}
                        {product.stock})
                      </option>
                    )
                  )}
                </select>

                <input
                  type="number"
                  min="1"
                  required
                  placeholder="Quantity"
                  value={saleQuantity}
                  onChange={(e) =>
                    setSaleQuantity(
                      e.target.value
                    )
                  }
                />

                <input
                  type="text"
                  placeholder="Customer Name (Optional)"
                  value={
                    saleCustomerName
                  }
                  onChange={(e) =>
                    setSaleCustomerName(
                      e.target.value
                    )
                  }
                />

                <button type="submit">
                  Complete Sale
                </button>
              </form>
            </div>

            <h2>
              Transaction History
            </h2>

            {sales.length === 0 ? (
              <div className="card">
                <p>
                  No sales transactions yet.
                </p>
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Total</th>
                    <th>Customer</th>
                    <th>Date</th>
                  </tr>
                </thead>

                <tbody>
                  {sales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        {sale.product_name}
                      </td>

                      <td>
                        {sale.quantity}
                      </td>

                      <td>
                        ₱
                        {sale.total_price.toFixed(
                          2
                        )}
                      </td>

                      <td>
                        {sale.customer_name}
                      </td>

                      <td>
                        {sale.sale_date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* CUSTOMERS */}

        {activeTab === "customers" && (
          <div>
            <h1>
              Customer Directory
            </h1>

            <div className="card">
              <h2>
                Add Customer
              </h2>

              <form
                onSubmit={handleAddCustomer}
                className="form-grid"
              >
                <input
                  type="text"
                  placeholder="Name"
                  required
                  value={customerName}
                  onChange={(e) =>
                    setCustomerName(
                      e.target.value
                    )
                  }
                />

                <input
                  type="email"
                  placeholder="Email"
                  required
                  value={customerEmail}
                  onChange={(e) =>
                    setCustomerEmail(
                      e.target.value
                    )
                  }
                />

                <input
                  type="text"
                  placeholder="Phone"
                  required
                  value={customerPhone}
                  onChange={(e) =>
                    setCustomerPhone(
                      e.target.value
                    )
                  }
                />

                <button type="submit">
                  Add Customer
                </button>
              </form>
            </div>

            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                </tr>
              </thead>

              <tbody>
                {customers.map(
                  (customer) => (
                    <tr key={customer.id}>
                      <td>
                        {customer.name}
                      </td>

                      <td>
                        {customer.email}
                      </td>

                      <td>
                        {customer.phone}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* REPORTS */}

        {activeTab === "reports" && (
          <div>
            <h1>
              Financial & Sales Reports
            </h1>

            <div className="card">
              <h2>
                Export Data
              </h2>

              <p className="welcome-text">
                Generate a PDF summary of
                all completed sales.
              </p>

              <button
                onClick={exportPDF}
              >
                Download PDF Report
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}