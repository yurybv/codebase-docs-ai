import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';

function App(): JSX.Element {
  return (
    <main className="shell">
      <section className="intro">
        <p className="eyebrow">Codebase Docs AI</p>
        <h1>Generate technical documentation from source archives.</h1>
        <p>
          Upload frontend, backend, shared, or infra source archives, then generate a
          structured documentation tree through the API-backed engine.
        </p>
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
