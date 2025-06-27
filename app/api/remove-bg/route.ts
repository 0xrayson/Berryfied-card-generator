import { type NextRequest, NextResponse } from "next/server"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("image") as File

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    // Create FormData for remove.bg API
    const removeBgFormData = new FormData()
    removeBgFormData.append("image_file", file)
    removeBgFormData.append("size", "auto")

    // Call remove.bg API (you'll need to add your API key to environment variables)
    const response = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: {
        "X-Api-Key": process.env.REMOVE_BG_API_KEY || "",
      },
      body: removeBgFormData,
    })

    if (!response.ok) {
      throw new Error("Background removal failed")
    }

    const resultBuffer = await response.arrayBuffer()
    const base64 = Buffer.from(resultBuffer).toString("base64")
    const dataUrl = `data:image/png;base64,${base64}`

    return NextResponse.json({
      success: true,
      processedImage: dataUrl,
    })
  } catch (error) {
    console.error("Error processing image:", error)
    return NextResponse.json({ error: "Failed to process image" }, { status: 500 })
  }
}
