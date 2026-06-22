async function test() {
  const formData = new FormData();
  // Create a 1x1 dummy image
  const dummyImage = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
  formData.append("image", new Blob([dummyImage], { type: "image/png" }), "dummy.png");
  formData.append("resolution", "512");
  formData.append("aspectRatio", "1:1");

  const res = await fetch("http://localhost:3000/api/image/extract", {
    method: "POST",
    body: formData
  });

  const text = await res.text();
  console.log("Status:", res.status);
  console.log("Response:", text.substring(0, 500));
}

test();
