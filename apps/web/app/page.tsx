export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "24px",
        padding: "48px",
        background: "var(--te-bg)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <div
          style={{
            width: "48px",
            height: "48px",
            borderRadius: "var(--te-radius-lg)",
            background: "var(--te-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "24px",
          }}
        >
          🇳🇬
        </div>
        <h1
          style={{
            fontSize: "28px",
            fontWeight: 700,
            color: "var(--te-primary)",
            letterSpacing: "-0.02em",
          }}
        >
          TaxEase Nigeria
        </h1>
      </div>

      <p
        style={{
          fontSize: "16px",
          color: "var(--te-text-secondary)",
          textAlign: "center",
          maxWidth: "500px",
          lineHeight: 1.6,
        }}
      >
        Bank Statement Tax Analyzer for Nigerian Self-Assessment.
        <br />
        Simplify your annual tax returns.
      </p>

      <div
        style={{
          display: "flex",
          gap: "12px",
          marginTop: "16px",
        }}
      >
        <a
          href="/sign-in"
          style={{
            padding: "10px 24px",
            borderRadius: "var(--te-radius)",
            background: "var(--te-primary)",
            color: "white",
            fontSize: "14px",
            fontWeight: 600,
            cursor: "pointer",
            textDecoration: "none",
          }}
        >
          Get Started →
        </a>
        <div
          style={{
            padding: "10px 24px",
            borderRadius: "var(--te-radius)",
            background: "var(--te-surface)",
            color: "var(--te-primary)",
            fontSize: "14px",
            fontWeight: 600,
            border: "1px solid var(--te-border)",
            cursor: "pointer",
          }}
        >
          Learn More
        </div>
      </div>

      <div
        style={{
          marginTop: "40px",
          padding: "16px 24px",
          borderRadius: "var(--te-radius)",
          background: "var(--te-surface)",
          border: "1px solid var(--te-border)",
          fontSize: "13px",
          color: "var(--te-text-muted)",
        }}
      >
        ✅ Phase 1 Complete — Monorepo scaffolded. All services running.
      </div>
    </div>
  );
}
