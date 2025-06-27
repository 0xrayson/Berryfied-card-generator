"use client"

import type React from "react"
import { useState, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Upload, Download, Loader2, AlertCircle } from "lucide-react"
import NextImage from "next/image"

export default function ProfileCardGenerator() {
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [processedImage, setProcessedImage] = useState<string | null>(null)
  const [username, setUsername] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [finalCard, setFinalCard] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select a valid image file")
      return
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB")
      return
    }

    setError(null)
    const reader = new FileReader()

    reader.onload = () => {
      const result = reader.result
      if (typeof result === "string") {
        setUploadedImage(result)
        setProcessedImage(null)
        setFinalCard(null)
      }
    }

    reader.onerror = () => {
      setError("Failed to read the image file")
    }

    reader.readAsDataURL(file)
  }, [])

  const advancedBackgroundRemoval = useCallback(async () => {
    if (!uploadedImage) return

    return new Promise<void>((resolve, reject) => {
      const img = new window.Image()
      img.crossOrigin = "anonymous"

      img.onload = () => {
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")

        if (!ctx) {
          reject(new Error("Canvas context not available"))
          return
        }

        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const data = imageData.data

        // Enhanced background removal algorithm
        const width = canvas.width
        const height = canvas.height

        // Step 1: Detect dominant background color (usually corners)
        const corners = [
          [0, 0],
          [width - 1, 0],
          [0, height - 1],
          [width - 1, height - 1],
          [Math.floor(width / 2), 0],
          [0, Math.floor(height / 2)],
          [width - 1, Math.floor(height / 2)],
          [Math.floor(width / 2), height - 1],
        ]

        let bgR = 0,
          bgG = 0,
          bgB = 0,
          cornerCount = 0
        corners.forEach(([x, y]) => {
          const idx = (y * width + x) * 4
          bgR += data[idx]
          bgG += data[idx + 1]
          bgB += data[idx + 2]
          cornerCount++
        })
        bgR = Math.floor(bgR / cornerCount)
        bgG = Math.floor(bgG / cornerCount)
        bgB = Math.floor(bgB / cornerCount)

        console.log(`Detected background color: RGB(${bgR}, ${bgG}, ${bgB})`)

        // Step 2: Remove background with multiple techniques
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i]
          const g = data[i + 1]
          const b = data[i + 2]

          // Calculate color difference from detected background
          const colorDiff = Math.sqrt(Math.pow(r - bgR, 2) + Math.pow(g - bgG, 2) + Math.pow(b - bgB, 2))

          // Calculate luminance
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b

          let shouldRemove = false

          // Technique 1: Similar to detected background color
          if (colorDiff < 50) {
            shouldRemove = true
          }
          // Technique 2: Very bright pixels (white backgrounds)
          else if (r > 240 && g > 240 && b > 240) {
            shouldRemove = true
          }
          // Technique 3: Very dark pixels (black backgrounds)
          else if (r < 15 && g < 15 && b < 15) {
            shouldRemove = true
          }
          // Technique 4: Uniform light colors
          else if (luminance > 200 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
            shouldRemove = true
          }
          // Technique 5: Green screen detection
          else if (g > r + 50 && g > b + 50 && g > 100) {
            shouldRemove = true
          }

          if (shouldRemove) {
            data[i + 3] = 0 // Make transparent
          }
        }

        // Step 3: Edge cleanup - remove isolated pixels
        const newData = new Uint8ClampedArray(data)
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = (y * width + x) * 4

            if (data[idx + 3] > 0) {
              // If pixel is visible
              let transparentNeighbors = 0

              // Check 8 surrounding pixels
              for (let dy = -1; dy <= 1; dy++) {
                for (let dx = -1; dx <= 1; dx++) {
                  if (dx === 0 && dy === 0) continue
                  const nIdx = ((y + dy) * width + (x + dx)) * 4
                  if (data[nIdx + 3] === 0) transparentNeighbors++
                }
              }

              // If surrounded by mostly transparent pixels, make it transparent
              if (transparentNeighbors >= 6) {
                newData[idx + 3] = 0
              }
            }
          }
        }

        ctx.putImageData(new ImageData(newData, width, height), 0, 0)
        setProcessedImage(canvas.toDataURL("image/png"))
        console.log("✅ Free background removal completed")
        resolve()
      }

      img.onerror = () => {
        console.error("Failed to load image for processing")
        reject(new Error("Failed to load image"))
      }

      img.src = uploadedImage
    })
  }, [uploadedImage])

  const removeBackground = useCallback(async () => {
    if (!uploadedImage) return
    setIsProcessing(true)
    setError(null)

    try {
      // Convert data-URL → Blob
      const blob = await (await fetch(uploadedImage)).blob()
      const formData = new FormData()
      formData.append("image", blob, "pfp.png")

      // 🔑 Try remove.bg API first
      const res = await fetch("/api/remove-bg", { method: "POST", body: formData })
      const json = await res.json()

      if (!json.success) throw new Error(json.error || "API failed")

      // API worked! Use the result
      setProcessedImage(json.processedImage as string)
      console.log("✅ Background removed using remove.bg API")
    } catch (apiError) {
      console.log("❌ API failed, trying free fallback method...")

      try {
        // API failed → automatically try free client-side method
        await advancedBackgroundRemoval()
        console.log("✅ Background removed using free fallback method")
      } catch (fallbackError) {
        console.error("Free fallback also failed:", fallbackError)
        setError("Background removal failed. Try an image with a clear subject on a solid background.")
      }
    } finally {
      setIsProcessing(false)
    }
  }, [uploadedImage, advancedBackgroundRemoval])

  const generateCard = useCallback(async () => {
    if (!processedImage || !username.trim()) return

    setIsGenerating(true)
    setError(null)

    try {
      const canvas = canvasRef.current
      if (!canvas) {
        throw new Error("Canvas not available")
      }

      const ctx = canvas.getContext("2d")
      if (!ctx) {
        throw new Error("Canvas context not available")
      }

      // Set canvas size
      canvas.width = 800
      canvas.height = 450

      // Load and draw background image
      const bgImg = new window.Image()
      bgImg.onload = () => {
        ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height)
        drawProfile()
      }
      bgImg.onerror = () => {
        console.warn("Background image failed to load – using gradient fallback")
        // Fallback: soft gradient
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        gradient.addColorStop(0, "#f0f9ff")
        gradient.addColorStop(1, "#fde9ff")
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)
        drawProfile()
      }
      bgImg.src = `${window.location.origin}/background.png`

      // ----- helper that draws the user's picture & username -----
      function drawProfile() {
        const img = new window.Image()
        img.onload = () => {
          // Make profile picture bigger (120px radius)
          const profileRadius = 120
          const profileX = 180
          const profileY = 200

          // Draw the profile image preserving transparency
          const imageSize = profileRadius * 2
          ctx.drawImage(img, profileX - profileRadius, profileY - profileRadius, imageSize, imageSize)

          // Add username text to align with "berryfied" in the background
         const usernameText = `@${username.trim()}
          ctx.fillStyle = "#1f2937"
          ctx.font = "bold 16px Arial, sans-serif"
          ctx.textBaseline = "middle"
          ctx.fillText(usernameText, 180, 406)

          setFinalCard(canvas.toDataURL("image/png", 0.9))
        }
        img.onerror = () => {
          throw new Error("Failed to load profile image")
        }
        img.crossOrigin = "anonymous"
        img.src = processedImage
      }
    } catch (error) {
      console.error("Error generating card:", error)
      setError(error instanceof Error ? error.message : "Failed to generate card")
    } finally {
      setIsGenerating(false)
    }
  }, [processedImage, username])

  const downloadCard = useCallback(() => {
    if (!finalCard || !username.trim()) return

    try {
      const link = document.createElement("a")
      link.download = `${username.trim()}-berryfied-card.png`
      link.href = finalCard
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error downloading card:", error)
      setError("Failed to download card")
    }
  }, [finalCard, username])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900">Berryfied Card Generator 🍓</h1>
          <p className="text-gray-600">Berrify yourself. Pledge allegiance to Boundless. No turning back now</p>
        </div>

        {/* Error Display */}
        {error && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center space-x-2 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearError}
                  className="ml-auto text-red-700 hover:text-red-900"
                >
                  ✕
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Upload Section */}
          <Card>
            <CardHeader>
              <CardTitle>Upload Profile Picture</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                {uploadedImage ? (
                  <div className="space-y-4">
                    <NextImage
                      src={uploadedImage}
                      alt="Uploaded profile"
                      width={200}
                      height={200}
                      className="mx-auto rounded-lg object-cover"
                      priority
                    />
                    <Button onClick={() => fileInputRef.current?.click()} variant="outline">
                      Change Image
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Upload className="mx-auto h-12 w-12 text-gray-400" />
                    <div>
                      <Button onClick={() => fileInputRef.current?.click()}>Choose Image</Button>
                      <p className="text-sm text-gray-500 mt-2">PNG, JPG up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                aria-label="Upload profile picture"
              />

              {uploadedImage && !processedImage && (
                <Button onClick={removeBackground} disabled={isProcessing} className="w-full">
                  {isProcessing ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Removing Background...
                    </>
                  ) : (
                    "Remove Background"
                  )}
                </Button>
              )}

              {processedImage && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-600 mb-2">Background Removed:</p>
                  <NextImage
                    src={processedImage}
                    alt="Background removed"
                    width={150}
                    height={150}
                    className="mx-auto rounded-lg"
                    style={{ backgroundColor: "transparent" }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Details Section */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Twitter Username</Label>
                <Input
                  id="username"
                  placeholder="Enter your Twitter username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value.replace("@", ""))}
                  maxLength={15}
                  aria-describedby="username-help"
                />
                <p id="username-help" className="text-sm text-gray-500">
                  Enter without the @ symbol
                </p>
              </div>

              {processedImage && username.trim() && (
                <Button onClick={generateCard} disabled={isGenerating} className="w-full">
                  {isGenerating ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Card...
                    </>
                  ) : (
                    "Generate Profile Card"
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Preview Section */}
        {finalCard && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Your Berryfied Card
                <Button onClick={downloadCard} size="sm">
                  <Download className="mr-2 h-4 w-4" />
                  Download
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex justify-center">
                <NextImage
                  src={finalCard}
                  alt="Generated berryfied profile card"
                  width={800}
                  height={450}
                  className="rounded-lg shadow-lg max-w-full h-auto"
                  priority
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Credits Footer */}
        <div className="text-center mt-8 text-xs text-gray-500">
          Built by @0xrayson, designed and inspired by @Lxdy_rxd
        </div>

        {/* Hidden canvas for image generation */}
        <canvas ref={canvasRef} className="hidden" aria-hidden="true" />
      </div>
    </div>
  )
}
