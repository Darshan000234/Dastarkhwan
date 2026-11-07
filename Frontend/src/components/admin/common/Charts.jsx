export function BarChart({
  data,
  labelKey = "name",
  valueKey = "value",
  money = false,
}) {
  const max = Math.max(1, ...data.map((entry) => Number(entry[valueKey] || 0)));
  return (
    <div className="ad-bar-chart">
      {data.map((entry, index) => (
        <div className="ad-bar-col" key={`${entry[labelKey]}-${index}`}>
          <span className="ad-bar-value">
            {money
              ? `₹${Math.round(entry[valueKey] / 1000)}k`
              : entry[valueKey]}
          </span>
          <div className="ad-bar-track">
            <i
              style={{
                height: `${Math.max(3, (Number(entry[valueKey] || 0) / max) * 100)}%`,
              }}
            />
          </div>
          <span className="ad-bar-label" title={entry[labelKey]}>
            {entry[labelKey]}
          </span>
        </div>
      ))}
    </div>
  );
}

export function DonutChart({ data }) {
  const total =
    data.reduce((sum, entry) => sum + Number(entry.value || 0), 0) || 1;
  const colors = [
    "#b85a2b",
    "#657451",
    "#d5a45f",
    "#6d8993",
    "#9b958a",
    "#b56d6d",
  ];
  let current = 0;
  const slices = data.map((entry, index) => {
    const start = current;
    current += (Number(entry.value || 0) / total) * 100;
    return `${colors[index % colors.length]} ${start}% ${current}%`;
  });
  return (
    <div className="ad-donut-wrap">
      <div
        className="ad-donut"
        style={{ background: `conic-gradient(${slices.join(",")})` }}
      >
        <div>
          <strong>{data.reduce((sum, entry) => sum + entry.value, 0)}</strong>
          <small>Orders</small>
        </div>
      </div>
      <div className="ad-donut-legend">
        {data
          .filter((entry) => entry.value > 0)
          .map((entry) => {
            const index = data.indexOf(entry);
            return (
              <div key={entry.name}>
                <i style={{ background: colors[index % colors.length] }} />
                <span>{entry.name}</span>
                <strong>{entry.value}</strong>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export function TrendChart({ data }) {
  const width = 620;
  const height = 185;
  const padX = 20;
  const padY = 18;
  const max = Math.max(1, ...data.map((entry) => entry.value));
  const points = data
    .map((entry, index) => {
      const x =
        padX +
        (data.length <= 1
          ? 0
          : (index * (width - padX * 2)) / (data.length - 1));
      const y = height - padY - (entry.value / max) * (height - padY * 2 - 15);
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <div className="ad-trend-chart">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label="Order trend based on the current sample order data"
        preserveAspectRatio="none"
      >
        {[0, 1, 2, 3].map((line) => (
          <line
            key={line}
            x1={padX}
            x2={width - padX}
            y1={padY + (line * (height - padY * 2)) / 3}
            y2={padY + (line * (height - padY * 2)) / 3}
            stroke="#eee9e0"
            strokeDasharray="3 5"
          />
        ))}
        <polyline
          points={points}
          fill="none"
          stroke="#b85a2b"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {data.map((entry, index) => {
          const x =
            padX +
            (data.length <= 1
              ? 0
              : (index * (width - padX * 2)) / (data.length - 1));
          const y =
            height - padY - (entry.value / max) * (height - padY * 2 - 15);
          return (
            <circle
              key={entry.label}
              cx={x}
              cy={y}
              r="4"
              fill="#fff"
              stroke="#b85a2b"
              strokeWidth="2"
            />
          );
        })}
      </svg>
      <div className="ad-trend-labels">
        {data.map((entry) => (
          <span key={entry.label}>{entry.label}</span>
        ))}
      </div>
    </div>
  );
}
