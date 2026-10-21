import { useState } from "react";

function App() {
  const [name, setName] = useState("");
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");

  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginMessage, setLoginMessage] = useState("");

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    setRegisterMessage("");

    try {
      const response = await fetch("http://localhost:3001/api/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          name,
          email: registerEmail,
          password: registerPassword,
        }),
      });

      const data = await response.json();
      setRegisterMessage(data.message);

      if (response.ok) {
        setName("");
        setRegisterEmail("");
        setRegisterPassword("");
      }
    } catch (error) {
      console.error(error);
      setRegisterMessage("Unable to connect to the server");
    }
  };

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginMessage("");

    try {
      const response = await fetch("http://localhost:3001/api/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: loginEmail,
          password: loginPassword,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setLoginMessage(data.message);
        return;
      }

      setLoginMessage(`Welcome, ${data.user.name}!`);
    } catch (error) {
      console.error(error);
      setLoginMessage("Unable to connect to the server");
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
            value={registerEmail}
            onChange={(event) => setRegisterEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label>Password</label>
          <br />
          <input
            type="password"
            value={registerPassword}
            onChange={(event) => setRegisterPassword(event.target.value)}
            required
          />
        </div>

        <br />

        <button type="submit">Create Account</button>
      </form>

      {registerMessage && <p>{registerMessage}</p>}

      <hr />

      <h2>Login</h2>

      <form onSubmit={handleLogin}>
        <div>
          <label>Email</label>
          <br />
          <input
            type="email"
            value={loginEmail}
            onChange={(event) => setLoginEmail(event.target.value)}
            required
          />
        </div>

        <div>
          <label>Password</label>
          <br />
          <input
            type="password"
            value={loginPassword}
            onChange={(event) => setLoginPassword(event.target.value)}
            required
          />
        </div>

        <br />

        <button type="submit">Login</button>
      </form>

      {loginMessage && <p>{loginMessage}</p>}
    </div>
  );
}

export default App;