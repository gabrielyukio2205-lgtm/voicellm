import { Client } from "https://cdn.jsdelivr.net/npm/@gradio/client/+esm";

const STORAGE_KEY = "voicemm_space_id";
const PLACEHOLDER_SPACE_ID = "Madras1/VoiceMM";

const form = document.querySelector("#ttsForm");
const textInput = document.querySelector("#textInput");
const voiceInput = document.querySelector("#voiceInput");
const speedInput = document.querySelector("#speedInput");
const speedValue = document.querySelector("#speedValue");
const spaceIdInput = document.querySelector("#spaceIdInput");
const saveConfigButton = document.querySelector("#saveConfigButton");
const generateButton = document.querySelector("#generateButton");
const statusText = document.querySelector("#statusText");
const audioPlayer = document.querySelector("#audioPlayer");
const downloadLink = document.querySelector("#downloadLink");
const metaBox = document.querySelector("#metaBox");
const charCount = document.querySelector("#charCount");
const sampleButtons = document.querySelectorAll(".sample-pill");

let cachedSpaceId = "";
let cachedClient = null;

function updateSpeedLabel() {
  speedValue.textContent = `${Number(speedInput.value).toFixed(2)}x`;
}

function updateCharacterCount() {
  charCount.textContent = String(textInput.value.length);
}

function setStatus(message) {
  statusText.textContent = message;
}

function setMeta(message, tone = "neutral") {
  metaBox.textContent = message;
  metaBox.classList.remove("is-error", "is-success");
  if (tone === "error") {
    metaBox.classList.add("is-error");
  }
  if (tone === "success") {
    metaBox.classList.add("is-success");
  }
}

function setBusy(isBusy) {
  generateButton.disabled = isBusy;
  generateButton.textContent = isBusy ? "Gerando..." : "Gerar audio";
}

function readSavedSpaceId() {
  return window.localStorage.getItem(STORAGE_KEY) || PLACEHOLDER_SPACE_ID;
}

function saveSpaceId() {
  const value = spaceIdInput.value.trim();
  window.localStorage.setItem(STORAGE_KEY, value || PLACEHOLDER_SPACE_ID);
  cachedClient = null;
  cachedSpaceId = "";
  setMeta("Space ID salvo neste navegador.", "success");
}

function normalizeFileData(fileData) {
  if (!fileData) {
    return null;
  }
  if (fileData instanceof Blob) {
    return { url: URL.createObjectURL(fileData) };
  }
  if (typeof fileData === "string") {
    return { url: fileData };
  }
  if (Array.isArray(fileData) && fileData.length > 0) {
    return normalizeFileData(fileData[0]);
  }
  return fileData;
}

function outputToText(rawMeta) {
  if (typeof rawMeta === "string") {
    return rawMeta.replaceAll("**", "").replaceAll("  \n", "\n");
  }
  return "Audio gerado com sucesso.";
}

function parseError(error) {
  if (error && typeof error === "object") {
    const message = error.message || error.error || "";
    if (message) {
      return String(message);
    }
  }
  return "Nao foi possivel gerar o audio. Confira o Space ID e tente novamente.";
}

async function getClient(spaceId) {
  const normalized = spaceId.trim();
  if (!normalized || normalized === PLACEHOLDER_SPACE_ID) {
    throw new Error("Preencha o Space ID real do Hugging Face antes de gerar.");
  }
  if (cachedClient && cachedSpaceId === normalized) {
    return cachedClient;
  }
  cachedClient = await Client.connect(normalized);
  cachedSpaceId = normalized;
  return cachedClient;
}

async function handleSubmit(event) {
  event.preventDefault();

  const text = textInput.value.trim();
  if (!text) {
    setMeta("Escreva algum texto antes de enviar.", "error");
    return;
  }

  setBusy(true);
  setStatus(
    "Conectando com a sua Space e pedindo o audio. Se ela estava dormindo, a primeira chamada pode levar um pouco."
  );
  setMeta("Aguardando resposta da API...");

  try {
    const client = await getClient(spaceIdInput.value);
    const result = await client.predict("/synthesize", [
      text,
      voiceInput.value,
      Number(speedInput.value),
    ]);

    const [audioData, rawMeta] = result.data;
    const fileData = normalizeFileData(audioData);
    const audioUrl = fileData?.url || fileData?.path;

    if (!audioUrl) {
      throw new Error("A resposta nao trouxe um arquivo de audio utilizavel.");
    }

    audioPlayer.src = audioUrl;
    audioPlayer.load();

    downloadLink.href = audioUrl;
    downloadLink.classList.remove("is-disabled");

    setStatus("Audio pronto.");
    setMeta(outputToText(rawMeta), "success");
  } catch (error) {
    audioPlayer.removeAttribute("src");
    downloadLink.href = "#";
    downloadLink.classList.add("is-disabled");
    setStatus("Falha ao falar com a Space.");
    setMeta(parseError(error), "error");
  } finally {
    setBusy(false);
  }
}

spaceIdInput.value = readSavedSpaceId();
updateSpeedLabel();
updateCharacterCount();
downloadLink.classList.add("is-disabled");

speedInput.addEventListener("input", updateSpeedLabel);
textInput.addEventListener("input", updateCharacterCount);
saveConfigButton.addEventListener("click", saveSpaceId);
form.addEventListener("submit", handleSubmit);

sampleButtons.forEach((button) => {
  button.addEventListener("click", () => {
    textInput.value = button.dataset.sample || "";
    updateCharacterCount();
    textInput.focus();
  });
});
