import { ImageResponse } from "next/og";

export const dynamic = "force-static";

export const alt = "Flowstry — Design Systems Where Flow Meets Structure";
export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#303030",
          backgroundImage:
            "radial-gradient(circle at 25% 25%, rgba(54, 195, 173, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 75%, rgba(42, 157, 143, 0.1) 0%, transparent 50%)",
        }}
      >
        {/* Grid overlay */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(54,195,173,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(54,195,173,0.05) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
            padding: "40px",
          }}
        >
          {/* Logo mark */}
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: "20px",
              background: "linear-gradient(135deg, #36C3AD 0%, #2A9D8F 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginBottom: 32,
              boxShadow: "0 20px 40px rgba(54, 195, 173, 0.3)",
            }}
          >
            <svg
              width="48"
                          height="30"
                          viewBox="0 0 165 105"
              fill="none"
                          xmlns="http://www.w3.org/2000/svg"
            >
                          <path
                              d="M73.4026 63.2735C63.8051 74.3853 58.8104 75.8693 52.2389 76.1254C38.7768 76.6502 16.0655 54.7085 11.0573 57.1687C6.04918 59.6289 1.55977 64.7809 0.0648638 74.6974C-1.43004 84.614 23.2219 97.9248 42.662 102.71C54.4694 105.617 67.2525 106.377 82.4899 90.2116C97.7272 74.0466 110.653 36.9542 121.857 33.861C133.061 30.7677 143.678 45.6884 150.772 46.0045C154.021 46.1493 165.208 44.8557 164.973 37.3701C164.738 29.8845 138.218 5.83348 125.431 0.759185C120.132 -1.34364 114.919 0.791254 108.986 8.80298C98.4982 22.965 83.0001 52.1617 73.4026 63.2735Z"
                              fill="white"
                          />
            </svg>
          </div>

          {/* Brand name */}
          <div
            style={{
              fontSize: 72,
              fontWeight: 800,
              color: "white",
              marginBottom: 16,
              letterSpacing: "-2px",
            }}
          >
            Flowstry
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 28,
              color: "#36C3AD",
              fontWeight: 600,
              marginBottom: 24,
            }}
          >
            Flow meets structure.
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: 20,
              color: "#a1a1aa",
              maxWidth: 600,
            }}
          >
            Visualize, design, and evolve complex systems with clarity.
          </div>
        </div>

        {/* Decorative elements */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            right: 40,
            display: "flex",
            gap: 12,
          }}
        >
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#36C3AD",
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#36C3AD",
              opacity: 0.6,
            }}
          />
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              backgroundColor: "#36C3AD",
              opacity: 0.3,
            }}
          />
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
