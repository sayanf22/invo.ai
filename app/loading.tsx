export default function Loading() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-4"
      style={{ backgroundColor: "#FBF7F0" }}
    >
      {/* Branded spinner ring */}
      <div className="relative w-14 h-14">
        <div
          className="absolute inset-0 rounded-full border-[3px] border-transparent animate-spin"
          style={{
            borderTopColor: "hsl(33 17% 10%)",
            borderRightColor: "hsl(33 17% 10% / 0.2)",
            animationDuration: "0.75s",
          }}
        />
        <div
          className="absolute inset-[5px] rounded-full"
          style={{ backgroundColor: "#FBF7F0" }}
        />
      </div>
      <p
        className="text-sm font-medium tracking-wide"
        style={{ color: "hsl(33 11% 40%)" }}
      >
        Clorefy
      </p>
    </div>
  )
}
