export default function PrescriptionView({ customer, rx }) {
  return (
    <div style={{ padding: 20, fontFamily: 'sans-serif' }}>
      
      {/* Header */}
      <h2 style={{ textAlign: 'center', marginBottom: 4 }}>
        OptiVision
      </h2>
      <p style={{ textAlign: 'center', color: '#666', marginTop: 0 }}>
        Eye Prescription
      </p>

      {/* Info */}
      <div style={{ marginTop: 20 }}>
        <strong>Customer:</strong> {customer.name} <br />
        <strong>Date:</strong> {new Date(rx.date).toLocaleDateString()}
      </div>

      {/* Table */}
      <div style={{ marginTop: 20 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={th}>Field</th>
              <th style={th}>Right Eye (OD)</th>
              <th style={th}>Left Eye (OS)</th>
            </tr>
          </thead>
          <tbody>
            {row('SPH', rx.rightSph, rx.leftSph)}
            {row('CYL', rx.rightCyl, rx.leftCyl)}
            {row('AXIS', rx.rightAxis, rx.leftAxis)}
            {row('ADD', rx.rightAdd, rx.leftAdd)}
            {row('PD', rx.rightPd || rx.pd, rx.leftPd || rx.pd)}
          </tbody>
        </table>
      </div>

      {/* Doctor */}
      {rx.doctorName && (
        <div style={{ marginTop: 20 }}>
          Doctor: {rx.doctorName}
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 30, fontSize: 12, color: '#666' }}>
        * System generated prescription
      </div>
    </div>
  );
}

const th = {
  border: '1px solid #ccc',
  padding: 8,
  background: '#f5f5f5'
};

const td = {
  border: '1px solid #ccc',
  padding: 8,
  textAlign: 'center'
};

const row = (label, right, left) => (
  <tr key={label}>
    <td style={td}>{label}</td>
    <td style={td}>{right ?? '-'}</td>
    <td style={td}>{left ?? '-'}</td>
  </tr>
);