let timer;
function announce(message) {
  const toast = document.querySelector(".demo-toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(timer);
  timer = setTimeout(() => (toast.hidden = true), 3200);
}
document.querySelectorAll("[data-save]").forEach((button) =>
  button.addEventListener("click", () => {
    const saved = button.getAttribute("aria-pressed") !== "true";
    button.setAttribute("aria-pressed", String(saved));
    button.textContent = saved ? "Saved ✓" : button.dataset.save;
    announce(
      saved
        ? "Saved in this preview. Your actual notebook is unchanged."
        : "Removed from this preview.",
    );
  }),
);
document
  .querySelectorAll("[data-demo]")
  .forEach((button) =>
    button.addEventListener("click", () => announce(button.dataset.demo)),
  );
