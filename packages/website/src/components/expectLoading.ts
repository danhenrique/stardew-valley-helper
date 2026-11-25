/** Test helper: fails unless a loading label is the screen-reader text of a skeleton (`role="status"`). */
export const expectLoading = (label: HTMLElement) => {
  if (!label.closest('[role="status"]'))
    throw new Error(
      `"${label.textContent}" is not inside a skeleton (role="status")`,
    );
  if (!label.classList.contains('sr-only'))
    throw new Error(
      `"${label.textContent}" is visible; a skeleton label is sr-only`,
    );
};
