export default function ClinicLogo({ size = 150 }) {
  return (
    <img
      src="/logo-el-rosario.svg"
      alt="Clínica Médica El Rosario"
      width={size}
      height={'auto'}
      style={{ display: "block" }}
    />
  );
}
