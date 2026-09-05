/*
 * Copyright 2026 343dev
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

#include <cstddef>
#include <cstdint>
#include <string>

#include "guetzli/jpeg_data.h"
#include "guetzli/jpeg_data_reader.h"
#include "guetzli/processor.h"
#include "guetzli/quality.h"
#include "guetzli/stats.h"

namespace {

constexpr double kUpstreamBytesPerPixel = 300.0;
constexpr double kWasmSafetyBytesPerPixel = 350.0;
constexpr int kLowestMemoryLimitMiB = 100;
constexpr int kHighestMemoryLimitMiB = 3500;
constexpr int kLowestQuality = 84;
constexpr int kHighestQuality = 110;
constexpr double kBytesPerMiB = 1024.0 * 1024.0;

std::string output;
std::string error_message;
std::string debug_output;

void ResetState() {
  output.clear();
  error_message.clear();
  debug_output.clear();
}

}  // namespace

extern "C" {

enum GuetzliStatus {
  GUETZLI_OK = 0,
  GUETZLI_INVALID_INPUT = 1,
  GUETZLI_MEMORY_LIMIT = 2,
  GUETZLI_PROCESSING_FAILED = 3,
  GUETZLI_INVALID_OPTIONS = 4,
};

// Ownership contract:
// - The caller owns input and may free it as soon as this function returns.
// - This bridge owns output, error_message, and debug_output.
// - Returned data remains valid until the next guetzli_encode() or
//   guetzli_reset().
// - JavaScript must reacquire HEAPU8 after this call because memory may grow.
int guetzli_encode(const std::uint8_t* input,
                   std::size_t input_size,
                   int quality,
                   int memory_limit_mib,
                   int verbose) {
  ResetState();

  if (input == nullptr || input_size == 0) {
    error_message = "JPEG input is empty";
    return GUETZLI_INVALID_INPUT;
  }
  if (quality < kLowestQuality || quality > kHighestQuality ||
      memory_limit_mib < kLowestMemoryLimitMiB ||
      memory_limit_mib > kHighestMemoryLimitMiB ||
      (verbose != 0 && verbose != 1)) {
    error_message = "Invalid bridge options";
    return GUETZLI_INVALID_OPTIONS;
  }

  const std::string input_data(reinterpret_cast<const char*>(input), input_size);
  guetzli::JPEGData jpeg_header;
  if (!guetzli::ReadJpeg(input_data, guetzli::JPEG_READ_HEADER, &jpeg_header)) {
    error_message = "Could not read JPEG header";
    return GUETZLI_INVALID_INPUT;
  }

  const double pixels =
      static_cast<double>(jpeg_header.width) * jpeg_header.height;
  const double upstream_estimate_mib =
      pixels * kUpstreamBytesPerPixel / kBytesPerMiB;
  if (memory_limit_mib < kLowestMemoryLimitMiB ||
      upstream_estimate_mib > memory_limit_mib) {
    error_message = "Guetzli memory limit would be exceeded";
    return GUETZLI_MEMORY_LIMIT;
  }

  const double wasm_safety_estimate_mib =
      pixels * kWasmSafetyBytesPerPixel / kBytesPerMiB;
  if (wasm_safety_estimate_mib > kHighestMemoryLimitMiB) {
    error_message = "WebAssembly memory limit would be exceeded";
    return GUETZLI_MEMORY_LIMIT;
  }

  guetzli::Params parameters;
  parameters.butteraugli_target = static_cast<float>(
      guetzli::ButteraugliScoreForQuality(quality));

  guetzli::ProcessStats statistics;
  if (verbose != 0) {
    statistics.debug_output = &debug_output;
  }

  if (!guetzli::Process(parameters, &statistics, input_data, &output)) {
    error_message = "Guetzli could not process the JPEG input";
    return GUETZLI_PROCESSING_FAILED;
  }

  return GUETZLI_OK;
}

const std::uint8_t* guetzli_output_data() {
  return reinterpret_cast<const std::uint8_t*>(output.data());
}

std::size_t guetzli_output_size() {
  return output.size();
}

const char* guetzli_error_message() {
  return error_message.c_str();
}

const char* guetzli_debug_output() {
  return debug_output.c_str();
}

void guetzli_reset() {
  ResetState();
}

}  // extern "C"
