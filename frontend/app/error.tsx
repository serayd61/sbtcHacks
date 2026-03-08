"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center">
      <div className="text-center max-w-md">
        <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
        <p className="text-gray-400 mb-6 text-sm">{error.message}</p>
        <button
          onClick={reset}
          className="bg-orange-500 hover:bg-orange-600 text-white font-semibold px-6 py-2 rounded-lg"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
