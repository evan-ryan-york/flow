"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"

function GoogleAuthCallbackContent() {
  const searchParams = useSearchParams()
  const connectionId = searchParams.get("connectionId")
  const error = searchParams.get("error")

  useEffect(() => {
    if (typeof window !== "undefined" && window.opener) {
      if (error) {
        window.opener.postMessage({
          type: "oauth-error",
          error: error,
        }, "*")
      } else {
        window.opener.postMessage({
          type: "oauth-success",
          connectionId: connectionId,
        }, "*")
      }
      window.close()
    }
  }, [connectionId, error])

  return (
    <div className="text-center">
      <p className="text-lg">
        {error ? "Authorization failed." : "Authorization successful!"}
      </p>
      <p className="text-sm text-muted-foreground mt-2">
        This window will close automatically...
      </p>
    </div>
  )
}

export default function GoogleAuthCallback() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Suspense fallback={<div className="text-center"><p>Loading...</p></div>}>
        <GoogleAuthCallbackContent />
      </Suspense>
    </div>
  )
}
