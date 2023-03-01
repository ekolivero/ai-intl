import { diff, diffString } from "json-diff";

type DiffStruct = {
  generatedJson: JSON;
  originalJson: JSON;
};

export function validateAllKeysMatch({
  generatedJson,
  originalJson,
}: DiffStruct) {
  const difference = diffString(originalJson, generatedJson, {
    keysOnly: true,
  });
  if (!difference) {
    return true;
  }
  return false;
}

export function getDiff({ generatedJson, originalJson }: DiffStruct) {
  return diff(generatedJson, originalJson, {
    keysOnly: true,
    outputNewOnly: true,
  });
}
