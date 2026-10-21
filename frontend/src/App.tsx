import { useState } from "react";

function App() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setMessage("");

    try {
      const response = await fetch("http://localhost:3001/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.message);
        return;
      }

      setMessage("Account created successfully!");

      setName("");
      setEmail("");
      setPassword("");
    } catch (error) {
      console.error(error);
      setMessage("Unable to connect to the server");
    }
  };

  return (
    <div>
      <h1>Goal Sync</h1>
      <h2>Create Account</h2>

      <form onSubmit={handleRegister}>
        <div>
          <label>Name</label>
          <br />
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>

        <div>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label>Password</label>
          <br />
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>

        <br />

        <button type="submit">Create Account</button>
      </form>

      {message && <p>{message}</p>}
    </div>
  );
}

export default App;