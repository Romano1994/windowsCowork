export interface DeletePreviousWordResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

export function deletePreviousWord(
  value: string,
  selectionStart: number,
  selectionEnd: number
): DeletePreviousWordResult {
  if (selectionStart !== selectionEnd) {
    return {
      value: value.slice(0, selectionStart) + value.slice(selectionEnd),
      selectionStart,
      selectionEnd: selectionStart,
    };
  }

  if (selectionStart === 0) {
    return {
      value,
      selectionStart: 0,
      selectionEnd: 0,
    };
  }

  let deleteFrom = selectionStart;

  while (deleteFrom > 0 && /\s/.test(value[deleteFrom - 1])) {
    deleteFrom -= 1;
  }

  while (deleteFrom > 0 && !/\s/.test(value[deleteFrom - 1])) {
    deleteFrom -= 1;
  }

  return {
    value: value.slice(0, deleteFrom) + value.slice(selectionStart),
    selectionStart: deleteFrom,
    selectionEnd: deleteFrom,
  };
}
