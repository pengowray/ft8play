// Free text character table
const FT8_CHAR_TABLE_FULL = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ+-./?";

// Costas array for sync
const COSTAS_ARRAY = [3, 1, 4, 0, 6, 5, 2];

// CRC polynomial
const CRC_POLYNOMIAL = 0x2757;  // 14-bit CRC polynomial without the leading 1

// Parity generator matrix for (174,91) LDPC code, stored in bitpacked format (MSB first)
// const uint8_t kFTX_LDPC_generator[FTX_LDPC_M][FTX_LDPC_K_BYTES] = [
kFTX_LDPC_generator = [
    [ 0x83, 0x29, 0xce, 0x11, 0xbf, 0x31, 0xea, 0xf5, 0x09, 0xf2, 0x7f, 0xc0 ],
    [ 0x76, 0x1c, 0x26, 0x4e, 0x25, 0xc2, 0x59, 0x33, 0x54, 0x93, 0x13, 0x20 ],
    [ 0xdc, 0x26, 0x59, 0x02, 0xfb, 0x27, 0x7c, 0x64, 0x10, 0xa1, 0xbd, 0xc0 ],
    [ 0x1b, 0x3f, 0x41, 0x78, 0x58, 0xcd, 0x2d, 0xd3, 0x3e, 0xc7, 0xf6, 0x20 ],
    [ 0x09, 0xfd, 0xa4, 0xfe, 0xe0, 0x41, 0x95, 0xfd, 0x03, 0x47, 0x83, 0xa0 ],
    [ 0x07, 0x7c, 0xcc, 0xc1, 0x1b, 0x88, 0x73, 0xed, 0x5c, 0x3d, 0x48, 0xa0 ],
    [ 0x29, 0xb6, 0x2a, 0xfe, 0x3c, 0xa0, 0x36, 0xf4, 0xfe, 0x1a, 0x9d, 0xa0 ],
    [ 0x60, 0x54, 0xfa, 0xf5, 0xf3, 0x5d, 0x96, 0xd3, 0xb0, 0xc8, 0xc3, 0xe0 ],
    [ 0xe2, 0x07, 0x98, 0xe4, 0x31, 0x0e, 0xed, 0x27, 0x88, 0x4a, 0xe9, 0x00 ],
    [ 0x77, 0x5c, 0x9c, 0x08, 0xe8, 0x0e, 0x26, 0xdd, 0xae, 0x56, 0x31, 0x80 ],
    [ 0xb0, 0xb8, 0x11, 0x02, 0x8c, 0x2b, 0xf9, 0x97, 0x21, 0x34, 0x87, 0xc0 ],
    [ 0x18, 0xa0, 0xc9, 0x23, 0x1f, 0xc6, 0x0a, 0xdf, 0x5c, 0x5e, 0xa3, 0x20 ],
    [ 0x76, 0x47, 0x1e, 0x83, 0x02, 0xa0, 0x72, 0x1e, 0x01, 0xb1, 0x2b, 0x80 ],
    [ 0xff, 0xbc, 0xcb, 0x80, 0xca, 0x83, 0x41, 0xfa, 0xfb, 0x47, 0xb2, 0xe0 ],
    [ 0x66, 0xa7, 0x2a, 0x15, 0x8f, 0x93, 0x25, 0xa2, 0xbf, 0x67, 0x17, 0x00 ],
    [ 0xc4, 0x24, 0x36, 0x89, 0xfe, 0x85, 0xb1, 0xc5, 0x13, 0x63, 0xa1, 0x80 ],
    [ 0x0d, 0xff, 0x73, 0x94, 0x14, 0xd1, 0xa1, 0xb3, 0x4b, 0x1c, 0x27, 0x00 ],
    [ 0x15, 0xb4, 0x88, 0x30, 0x63, 0x6c, 0x8b, 0x99, 0x89, 0x49, 0x72, 0xe0 ],
    [ 0x29, 0xa8, 0x9c, 0x0d, 0x3d, 0xe8, 0x1d, 0x66, 0x54, 0x89, 0xb0, 0xe0 ],
    [ 0x4f, 0x12, 0x6f, 0x37, 0xfa, 0x51, 0xcb, 0xe6, 0x1b, 0xd6, 0xb9, 0x40 ],
    [ 0x99, 0xc4, 0x72, 0x39, 0xd0, 0xd9, 0x7d, 0x3c, 0x84, 0xe0, 0x94, 0x00 ],
    [ 0x19, 0x19, 0xb7, 0x51, 0x19, 0x76, 0x56, 0x21, 0xbb, 0x4f, 0x1e, 0x80 ],
    [ 0x09, 0xdb, 0x12, 0xd7, 0x31, 0xfa, 0xee, 0x0b, 0x86, 0xdf, 0x6b, 0x80 ],
    [ 0x48, 0x8f, 0xc3, 0x3d, 0xf4, 0x3f, 0xbd, 0xee, 0xa4, 0xea, 0xfb, 0x40 ],
    [ 0x82, 0x74, 0x23, 0xee, 0x40, 0xb6, 0x75, 0xf7, 0x56, 0xeb, 0x5f, 0xe0 ],
    [ 0xab, 0xe1, 0x97, 0xc4, 0x84, 0xcb, 0x74, 0x75, 0x71, 0x44, 0xa9, 0xa0 ],
    [ 0x2b, 0x50, 0x0e, 0x4b, 0xc0, 0xec, 0x5a, 0x6d, 0x2b, 0xdb, 0xdd, 0x00 ],
    [ 0xc4, 0x74, 0xaa, 0x53, 0xd7, 0x02, 0x18, 0x76, 0x16, 0x69, 0x36, 0x00 ],
    [ 0x8e, 0xba, 0x1a, 0x13, 0xdb, 0x33, 0x90, 0xbd, 0x67, 0x18, 0xce, 0xc0 ],
    [ 0x75, 0x38, 0x44, 0x67, 0x3a, 0x27, 0x78, 0x2c, 0xc4, 0x20, 0x12, 0xe0 ],
    [ 0x06, 0xff, 0x83, 0xa1, 0x45, 0xc3, 0x70, 0x35, 0xa5, 0xc1, 0x26, 0x80 ],
    [ 0x3b, 0x37, 0x41, 0x78, 0x58, 0xcc, 0x2d, 0xd3, 0x3e, 0xc3, 0xf6, 0x20 ],
    [ 0x9a, 0x4a, 0x5a, 0x28, 0xee, 0x17, 0xca, 0x9c, 0x32, 0x48, 0x42, 0xc0 ],
    [ 0xbc, 0x29, 0xf4, 0x65, 0x30, 0x9c, 0x97, 0x7e, 0x89, 0x61, 0x0a, 0x40 ],
    [ 0x26, 0x63, 0xae, 0x6d, 0xdf, 0x8b, 0x5c, 0xe2, 0xbb, 0x29, 0x48, 0x80 ],
    [ 0x46, 0xf2, 0x31, 0xef, 0xe4, 0x57, 0x03, 0x4c, 0x18, 0x14, 0x41, 0x80 ],
    [ 0x3f, 0xb2, 0xce, 0x85, 0xab, 0xe9, 0xb0, 0xc7, 0x2e, 0x06, 0xfb, 0xe0 ],
    [ 0xde, 0x87, 0x48, 0x1f, 0x28, 0x2c, 0x15, 0x39, 0x71, 0xa0, 0xa2, 0xe0 ],
    [ 0xfc, 0xd7, 0xcc, 0xf2, 0x3c, 0x69, 0xfa, 0x99, 0xbb, 0xa1, 0x41, 0x20 ],
    [ 0xf0, 0x26, 0x14, 0x47, 0xe9, 0x49, 0x0c, 0xa8, 0xe4, 0x74, 0xce, 0xc0 ],
    [ 0x44, 0x10, 0x11, 0x58, 0x18, 0x19, 0x6f, 0x95, 0xcd, 0xd7, 0x01, 0x20 ],
    [ 0x08, 0x8f, 0xc3, 0x1d, 0xf4, 0xbf, 0xbd, 0xe2, 0xa4, 0xea, 0xfb, 0x40 ],
    [ 0xb8, 0xfe, 0xf1, 0xb6, 0x30, 0x77, 0x29, 0xfb, 0x0a, 0x07, 0x8c, 0x00 ],
    [ 0x5a, 0xfe, 0xa7, 0xac, 0xcc, 0xb7, 0x7b, 0xbc, 0x9d, 0x99, 0xa9, 0x00 ],
    [ 0x49, 0xa7, 0x01, 0x6a, 0xc6, 0x53, 0xf6, 0x5e, 0xcd, 0xc9, 0x07, 0x60 ],
    [ 0x19, 0x44, 0xd0, 0x85, 0xbe, 0x4e, 0x7d, 0xa8, 0xd6, 0xcc, 0x7d, 0x00 ],
    [ 0x25, 0x1f, 0x62, 0xad, 0xc4, 0x03, 0x2f, 0x0e, 0xe7, 0x14, 0x00, 0x20 ],
    [ 0x56, 0x47, 0x1f, 0x87, 0x02, 0xa0, 0x72, 0x1e, 0x00, 0xb1, 0x2b, 0x80 ],
    [ 0x2b, 0x8e, 0x49, 0x23, 0xf2, 0xdd, 0x51, 0xe2, 0xd5, 0x37, 0xfa, 0x00 ],
    [ 0x6b, 0x55, 0x0a, 0x40, 0xa6, 0x6f, 0x47, 0x55, 0xde, 0x95, 0xc2, 0x60 ],
    [ 0xa1, 0x8a, 0xd2, 0x8d, 0x4e, 0x27, 0xfe, 0x92, 0xa4, 0xf6, 0xc8, 0x40 ],
    [ 0x10, 0xc2, 0xe5, 0x86, 0x38, 0x8c, 0xb8, 0x2a, 0x3d, 0x80, 0x75, 0x80 ],
    [ 0xef, 0x34, 0xa4, 0x18, 0x17, 0xee, 0x02, 0x13, 0x3d, 0xb2, 0xeb, 0x00 ],
    [ 0x7e, 0x9c, 0x0c, 0x54, 0x32, 0x5a, 0x9c, 0x15, 0x83, 0x6e, 0x00, 0x00 ],
    [ 0x36, 0x93, 0xe5, 0x72, 0xd1, 0xfd, 0xe4, 0xcd, 0xf0, 0x79, 0xe8, 0x60 ],
    [ 0xbf, 0xb2, 0xce, 0xc5, 0xab, 0xe1, 0xb0, 0xc7, 0x2e, 0x07, 0xfb, 0xe0 ],
    [ 0x7e, 0xe1, 0x82, 0x30, 0xc5, 0x83, 0xcc, 0xcc, 0x57, 0xd4, 0xb0, 0x80 ],
    [ 0xa0, 0x66, 0xcb, 0x2f, 0xed, 0xaf, 0xc9, 0xf5, 0x26, 0x64, 0x12, 0x60 ],
    [ 0xbb, 0x23, 0x72, 0x5a, 0xbc, 0x47, 0xcc, 0x5f, 0x4c, 0xc4, 0xcd, 0x20 ],
    [ 0xde, 0xd9, 0xdb, 0xa3, 0xbe, 0xe4, 0x0c, 0x59, 0xb5, 0x60, 0x9b, 0x40 ],
    [ 0xd9, 0xa7, 0x01, 0x6a, 0xc6, 0x53, 0xe6, 0xde, 0xcd, 0xc9, 0x03, 0x60 ],
    [ 0x9a, 0xd4, 0x6a, 0xed, 0x5f, 0x70, 0x7f, 0x28, 0x0a, 0xb5, 0xfc, 0x40 ],
    [ 0xe5, 0x92, 0x1c, 0x77, 0x82, 0x25, 0x87, 0x31, 0x6d, 0x7d, 0x3c, 0x20 ],
    [ 0x4f, 0x14, 0xda, 0x82, 0x42, 0xa8, 0xb8, 0x6d, 0xca, 0x73, 0x35, 0x20 ],
    [ 0x8b, 0x8b, 0x50, 0x7a, 0xd4, 0x67, 0xd4, 0x44, 0x1d, 0xf7, 0x70, 0xe0 ],
    [ 0x22, 0x83, 0x1c, 0x9c, 0xf1, 0x16, 0x94, 0x67, 0xad, 0x04, 0xb6, 0x80 ],
    [ 0x21, 0x3b, 0x83, 0x8f, 0xe2, 0xae, 0x54, 0xc3, 0x8e, 0xe7, 0x18, 0x00 ],
    [ 0x5d, 0x92, 0x6b, 0x6d, 0xd7, 0x1f, 0x08, 0x51, 0x81, 0xa4, 0xe1, 0x20 ],
    [ 0x66, 0xab, 0x79, 0xd4, 0xb2, 0x9e, 0xe6, 0xe6, 0x95, 0x09, 0xe5, 0x60 ],
    [ 0x95, 0x81, 0x48, 0x68, 0x2d, 0x74, 0x8a, 0x38, 0xdd, 0x68, 0xba, 0xa0 ],
    [ 0xb8, 0xce, 0x02, 0x0c, 0xf0, 0x69, 0xc3, 0x2a, 0x72, 0x3a, 0xb1, 0x40 ],
    [ 0xf4, 0x33, 0x1d, 0x6d, 0x46, 0x16, 0x07, 0xe9, 0x57, 0x52, 0x74, 0x60 ],
    [ 0x6d, 0xa2, 0x3b, 0xa4, 0x24, 0xb9, 0x59, 0x61, 0x33, 0xcf, 0x9c, 0x80 ],
    [ 0xa6, 0x36, 0xbc, 0xbc, 0x7b, 0x30, 0xc5, 0xfb, 0xea, 0xe6, 0x7f, 0xe0 ],
    [ 0x5c, 0xb0, 0xd8, 0x6a, 0x07, 0xdf, 0x65, 0x4a, 0x90, 0x89, 0xa2, 0x00 ],
    [ 0xf1, 0x1f, 0x10, 0x68, 0x48, 0x78, 0x0f, 0xc9, 0xec, 0xdd, 0x80, 0xa0 ],
    [ 0x1f, 0xbb, 0x53, 0x64, 0xfb, 0x8d, 0x2c, 0x9d, 0x73, 0x0d, 0x5b, 0xa0 ],
    [ 0xfc, 0xb8, 0x6b, 0xc7, 0x0a, 0x50, 0xc9, 0xd0, 0x2a, 0x5d, 0x03, 0x40 ],
    [ 0xa5, 0x34, 0x43, 0x30, 0x29, 0xea, 0xc1, 0x5f, 0x32, 0x2e, 0x34, 0xc0 ],
    [ 0xc9, 0x89, 0xd9, 0xc7, 0xc3, 0xd3, 0xb8, 0xc5, 0x5d, 0x75, 0x13, 0x00 ],
    [ 0x7b, 0xb3, 0x8b, 0x2f, 0x01, 0x86, 0xd4, 0x66, 0x43, 0xae, 0x96, 0x20 ],
    [ 0x26, 0x44, 0xeb, 0xad, 0xeb, 0x44, 0xb9, 0x46, 0x7d, 0x1f, 0x42, 0xc0 ],
    [ 0x60, 0x8c, 0xc8, 0x57, 0x59, 0x4b, 0xfb, 0xb5, 0x5d, 0x69, 0x60, 0x00 ]
];

// Parity check matrix (kFTX_LDPC_Nm)
const LDPC_MATRIX = [
    [ 4, 31, 59, 91, 92, 96, 153 ],
    [ 5, 32, 60, 93, 115, 146, 0 ],
    [ 6, 24, 61, 94, 122, 151, 0 ],
    [ 7, 33, 62, 95, 96, 143, 0 ],
    [ 8, 25, 63, 83, 93, 96, 148 ],
    [ 6, 32, 64, 97, 126, 138, 0 ],
    [ 5, 34, 65, 78, 98, 107, 154 ],
    [ 9, 35, 66, 99, 139, 146, 0 ],
    [ 10, 36, 67, 100, 107, 126, 0 ],
    [ 11, 37, 67, 87, 101, 139, 158 ],
    [ 12, 38, 68, 102, 105, 155, 0 ],
    [ 13, 39, 69, 103, 149, 162, 0 ],
    [ 8, 40, 70, 82, 104, 114, 145 ],
    [ 14, 41, 71, 88, 102, 123, 156 ],
    [ 15, 42, 59, 106, 123, 159, 0 ],
    [ 1, 33, 72, 106, 107, 157, 0 ],
    [ 16, 43, 73, 108, 141, 160, 0 ],
    [ 17, 37, 74, 81, 109, 131, 154 ],
    [ 11, 44, 75, 110, 121, 166, 0 ],
    [ 45, 55, 64, 111, 130, 161, 173 ],
    [ 8, 46, 71, 112, 119, 166, 0 ],
    [ 18, 36, 76, 89, 113, 114, 143 ],
    [ 19, 38, 77, 104, 116, 163, 0 ],
    [ 20, 47, 70, 92, 138, 165, 0 ],
    [ 2, 48, 74, 113, 128, 160, 0 ],
    [ 21, 45, 78, 83, 117, 121, 151 ],
    [ 22, 47, 58, 118, 127, 164, 0 ],
    [ 16, 39, 62, 112, 134, 158, 0 ],
    [ 23, 43, 79, 120, 131, 145, 0 ],
    [ 19, 35, 59, 73, 110, 125, 161 ],
    [ 20, 36, 63, 94, 136, 161, 0 ],
    [ 14, 31, 79, 98, 132, 164, 0 ],
    [ 3, 44, 80, 124, 127, 169, 0 ],
    [ 19, 46, 81, 117, 135, 167, 0 ],
    [ 7, 49, 58, 90, 100, 105, 168 ],
    [ 12, 50, 61, 118, 119, 144, 0 ],
    [ 13, 51, 64, 114, 118, 157, 0 ],
    [ 24, 52, 76, 129, 148, 149, 0 ],
    [ 25, 53, 69, 90, 101, 130, 156 ],
    [ 20, 46, 65, 80, 120, 140, 170 ],
    [ 21, 54, 77, 100, 140, 171, 0 ],
    [ 35, 82, 133, 142, 171, 174, 0 ],
    [ 14, 30, 83, 113, 125, 170, 0 ],
    [ 4, 29, 68, 120, 134, 173, 0 ],
    [ 1, 4, 52, 57, 86, 136, 152 ],
    [ 26, 51, 56, 91, 122, 137, 168 ],
    [ 52, 84, 110, 115, 145, 168, 0 ],
    [ 7, 50, 81, 99, 132, 173, 0 ],
    [ 23, 55, 67, 95, 172, 174, 0 ],
    [ 26, 41, 77, 109, 141, 148, 0 ],
    [ 2, 27, 41, 61, 62, 115, 133 ],
    [ 27, 40, 56, 124, 125, 126, 0 ],
    [ 18, 49, 55, 124, 141, 167, 0 ],
    [ 6, 33, 85, 108, 116, 156, 0 ],
    [ 28, 48, 70, 85, 105, 129, 158 ],
    [ 9, 54, 63, 131, 147, 155, 0 ],
    [ 22, 53, 68, 109, 121, 174, 0 ],
    [ 3, 13, 48, 78, 95, 123, 0 ],
    [ 31, 69, 133, 150, 155, 169, 0 ],
    [ 12, 43, 66, 89, 97, 135, 159 ],
    [ 5, 39, 75, 102, 136, 167, 0 ],
    [ 2, 54, 86, 101, 135, 164, 0 ],
    [ 15, 56, 87, 108, 119, 171, 0 ],
    [ 10, 44, 82, 91, 111, 144, 149 ],
    [ 23, 34, 71, 94, 127, 153, 0 ],
    [ 11, 49, 88, 92, 142, 157, 0 ],
    [ 29, 34, 87, 97, 147, 162, 0 ],
    [ 30, 50, 60, 86, 137, 142, 162 ],
    [ 10, 53, 66, 84, 112, 128, 165 ],
    [ 22, 57, 85, 93, 140, 159, 0 ],
    [ 28, 32, 72, 103, 132, 166, 0 ],
    [ 28, 29, 84, 88, 117, 143, 150 ],
    [ 1, 26, 45, 80, 128, 147, 0 ],
    [ 17, 27, 89, 103, 116, 153, 0 ],
    [ 51, 57, 98, 163, 165, 172, 0 ],
    [ 21, 37, 73, 138, 152, 169, 0 ],
    [ 16, 47, 76, 130, 137, 154, 0 ],
    [ 3, 24, 30, 72, 104, 139, 0 ],
    [ 9, 40, 90, 106, 134, 151, 0 ],
    [ 15, 58, 60, 74, 111, 150, 163 ],
    [ 18, 42, 79, 144, 146, 152, 0 ],
    [ 25, 38, 65, 99, 122, 160, 0 ],
    [ 17, 42, 75, 129, 170, 172, 0 ]
];

// Number of rows in each parity check (kFTX_LDPC_Num_rows)
const LDPC_NUM_ROWS = [
    7, 6, 6, 6, 7, 6, 7, 6, 6, 7, 6, 6, 7, 7, 6, 6,
    6, 7, 6, 7, 6, 7, 6, 6, 6, 7, 6, 6, 6, 7, 6, 6,
    6, 6, 7, 6, 6, 6, 7, 7, 6, 6, 6, 6, 7, 7, 6, 6,
    6, 6, 7, 6, 6, 6, 7, 6, 6, 6, 6, 7, 6, 6, 6, 7,
    6, 6, 6, 7, 7, 6, 6, 7, 6, 6, 6, 6, 6, 6, 6, 7,
    6, 6, 6
];

// Gray code map (FTx bits -> channel symbols)
const GRAY_MAP = [0, 1, 3, 2, 5, 6, 4, 7];
const GRAY_INV = [0, 1, 3, 2, 6, 4, 5, 7];
const GRAY_OFF = [0, 1, 2, 3, 4, 5, 6, 7];

function symbolsToBitsStr(symbols) {
    return symbols.split('').map(s => GRAY_INV[parseInt(s)].toString(2).padStart(3, '0')).join('');
}

function symbolsToBitsStrNoCosta(symbols) {
   var symbolsWithoutCostas = symbols.slice(7, 36) + symbols.slice(43, 72);
   //return symbolsToBitsStr(symbolsWithoutCostas);
   return symbolsWithoutCostas.split('').map(s => GRAY_INV[parseInt(s)].toString(2).padStart(3, '0')).join('');
}

function bitsToSymbols(binaryString) {
    let symbols = "";
    
    if (binaryString.length % 3 !== 0) throw new Error("Bad input to bitsToSymbols");

    for (let i = 0; i < binaryString.length; i += 3) {
        const bits = binaryString.slice(i, i + 3);
        const decimal = parseInt(bits, 2);
        symbols += GRAY_MAP[decimal].toString();
    }
    return symbols;
}

function binary195ToSymbols(binaryString) {

    return bitsToSymbols(binaryString);
}

function binary174ToSymbols(binaryString) {
    const sync = "3140652";
    //return sync.concat(bitsToSymbols(binaryString.slice(0, 29*3)).concat(sync).concat(bitsToSymbols( binaryString.slice(29*3, 58*3))).concat(sync);
    return `${sync}${bitsToSymbols(binaryString.slice(0, 29*3))}${sync}${bitsToSymbols(binaryString.slice(29*3, 58*3))}${sync}`;
}

function binary91ToSymbols(binaryString) { // 77 bits + CRC
    //const bits174 = binaryString.padEnd(174, '0')
    //const symbolsNoLDPC = binary174ToSymbols(bits174); 

    const ldpc = calculateParity(binaryString);

    //return binary174ToSymbols(binaryString + ldpc);
    return binary174ToSymbols(ldpc.fullCodeword);

}

function checkSync(symbols) {
    const syncPositions = [0, 36, 72];
    let errors = [];
    
    for (let i = 0; i < syncPositions.length; i++) {
        for (let j = 0; j < COSTAS_ARRAY.length; j++) {
            if (parseInt(symbols[syncPositions[i] + j]) !== COSTAS_ARRAY[j]) {
                errors.push(syncPositions[i] + j);
            }
        }
    }
    
    return {
        result: errors.length === 0 ? 'OK' : 'FAILED',
        errors: errors // list of bad symbols
    };
}

function printMessageDetails(symbols) {
    let bitString = symbolsToBitsStrNoCosta(symbols);

    if (symbols && symbols.length == 79) {
        console.log("Source-encoded message, 77 bits:\n"
         + bitString.slice(0, 77) + "\n\n"

         + "14-bit CRC: \n" 
         + bitString.slice(77, 91) + "\n\n"

         + "83 Parity bits\n"
         + bitString.slice(91)  + "\n\n"

         + "Channel symbols (79 tones):\n"
         + "  Sync               Data               Sync               Data               Sync\n"
         + `${symbols.slice(0, 7)} ${symbols.slice(7, 36)} ${symbols.slice(36, 43)} ${symbols.slice(43, 72)} ${symbols.slice(72)}\n`);
    } else if (symbols && symbols.length > 0) {
        console.log(`Symbols (not 79): '${symbols}'`);
    }
}

const FT8_CRC_WIDTH = 14;
const FT8_CRC_POLYNOMIAL = 0x2757;  // 14-bit CRC polynomial without the leading 1
const TOPBIT = 1 << (FT8_CRC_WIDTH - 1);

function ftx_compute_crc(message, num_bits) {
    let remainder = 0;
    let idx_byte = 0;

    // Perform modulo-2 division, a bit at a time.
    for (let idx_bit = 0; idx_bit < num_bits; ++idx_bit) {
        if (idx_bit % 8 === 0) {
            // Bring the next byte into the remainder.
            remainder ^= (message[idx_byte] << (FT8_CRC_WIDTH - 8));
            ++idx_byte;
        }

        // Try to divide the current data bit.
        if (remainder & TOPBIT) {
            remainder = (remainder << 1) ^ FT8_CRC_POLYNOMIAL;
        } else {
            remainder = (remainder << 1);
        }
    }

    return remainder & ((TOPBIT << 1) - 1);
}

function checkCRC(symbols) {
    let bitString = symbolsToBitsStrNoCosta(symbols);
    let message = bitString.slice(0, 77).padEnd(82, '0').split('').map(Number);
    
    // Convert bit array to byte array
    let messageBytes = [];
    for (let i = 0; i < 82; i += 8) {
        messageBytes.push(parseInt(message.slice(i, i + 8).join(''), 2));
    }
    
    let calculatedCRC = ftx_compute_crc(messageBytes, 82);
    let receivedCRC = parseInt(bitString.slice(77, 91), 2);
    
    return {
        crc: calculatedCRC.toString(2).padStart(14, '0'),
        received: receivedCRC.toString(2).padStart(14, '0'),
        result: calculatedCRC === receivedCRC ? 'OK' : 'FAILED'
    };
}

function checkParity(symbols) {
    let bits = symbolsToBitsStrNoCosta(symbols).slice(0, 174).split('').map(Number);  // We need all 174 bits
    
    let failedParityBits = new Set();
    let failedMessageBits = new Set();

    // Check parity equations
    for (let i = 0; i < LDPC_MATRIX.length; i++) {
        let sum = 0;
        for (let j = 0; j < LDPC_NUM_ROWS[i]; j++) {
            let bitIndex = LDPC_MATRIX[i][j] - 1;  // Adjust for 0-based indexing
            if (bitIndex >= 0 && bitIndex < 174) {
                //sum ^= bits[bitIndex] === '0' ? 0 : 1;
                sum ^= bits[bitIndex];
            }
        }
        if (sum !== 0) {
            failedParityBits.add(i);
            for (let j = 0; j < LDPC_NUM_ROWS[i]; j++) {
                let bitIndex = LDPC_MATRIX[i][j] - 1;
                if (bitIndex >= 0 && bitIndex < 91) {  // Only include message bits
                    failedMessageBits.add(bitIndex);
                }
            }
        }
    }
    
    return {
        result: failedParityBits.size === 0 ? 'OK' : 'FAILED',
        failedParityCount: failedParityBits.size,
        failedMessageCount: failedMessageBits.size,
        failedParityErrors: Array.from(failedParityBits),
        failedMessageErrors: Array.from(failedMessageBits)
    };
}

function calculateParity(binaryString) {
    if (binaryString.length !== 91) {
        throw new Error("Input must be 91 bits long (77 message bits + 14 CRC bits)");
    }

    let messageBits = binaryString.split('').map(Number);
    let parityBits = new Array(83).fill(0);

    // Convert message bits to bytes
    let messageBytes = [];
    for (let i = 0; i < 91; i += 8) {
        let byte = 0;
        for (let j = 0; j < 8 && i + j < 91; j++) {
            byte |= messageBits[i + j] << (7 - j);
        }
        messageBytes.push(byte);
    }

    // Calculate parity bits using generator matrix
    for (let i = 0; i < 83; i++) {
        for (let j = 0; j < 12; j++) {
            let generatorByte = kFTX_LDPC_generator[i][j];
            for (let k = 0; k < 8; k++) {
                if (j * 8 + k < 91) {
                    parityBits[i] ^= ((generatorByte >> (7 - k)) & 1) & messageBits[j * 8 + k];
                }
            }
        }
    }

    // Combine message bits and parity bits
    let fullCodeword = messageBits.concat(parityBits);

    return {
        parityBits: parityBits.join(''),
        fullCodeword: fullCodeword.join('')
    };
}

// not used / tested
function decodeFT8FreeText(payload) {
    if (!(payload instanceof Uint8Array) || payload.length !== 10) {
        throw new Error("Invalid payload: must be a Uint8Array of length 10");
    }

    // Extract the 71 bits of free text data
    let n71 = BigInt(0);
    for (let i = 0; i < 9; i++) {
        n71 = (n71 << BigInt(8)) | BigInt(payload[i]);
    }

    // Decode the text
    let text = "";
    for (let i = 0; i < 13; i++) {
        let index = Number(n71 % BigInt(42));
        text = FT8_CHAR_TABLE_FULL[index] + text;
        n71 = n71 / BigInt(42);
    }

    // Trim trailing spaces
    text = text.trimEnd();

    return text;
}


// Example usage
//const payload = new Uint8Array([0x17, 0x6C, 0x5D, 0xB8, 0x73, 0x7F, 0x8A, 0x49, 0x30, 0x00]);
//console.log(decodeFT8FreeText(payload));

function encodeFT8FreeText(message) {
  const MAX_LEN = 13;
  // Ensure the message is no longer than 13 characters
  message = message.slice(0, MAX_LEN).toUpperCase();
  
  // Pad the message to 13 characters with spaces
  message = message.padStart(MAX_LEN, ' ');

  // Initialize the result as a BigInt
  let result = 0n;
  
  // Encode each character
  for (let i = 0; i < MAX_LEN; i++) {
    const charIndex = FT8_CHAR_TABLE_FULL.indexOf(message[i]);
    result = result * 42n + BigInt(charIndex);
  }
  
  // Convert to 71-bit binary string
  let binaryString = result.toString(2).padStart(71, '0');

  // message type 0.0 (6 bits) + 3 bits padding to get to 80
  binaryString = binaryString + '000000000';

  // Convert binary string to Uint8Array
  const output = new Uint8Array(10);
  for (let i = 0; i < 10; i++) {
    output[i] = parseInt(binaryString.slice(i * 8, (i + 1) * 8), 2);
  }
  
  return output;
}

// Encode 71-bit telemetry data
function encodeFT8Telemetry(telemetryHex) {
  // Ensure the input is a valid 18-character hex string
  if (!/^[0-9A-Fa-f]{1,18}$/.test(telemetryHex)) {
    return { "error": "Error: Telemetry data must be a 1 to 18 character hex string" };
  }

  // Convert hex to binary string
  let binaryString = hexToBinary(telemetryHex).replace(/^0*/g, '');

  // Add message type 0.5 (000101 in binary)
  binaryString = binaryString.padStart(71, '0') + '101000' // slice(-71)

  // Check if the binary string starts with 1 (exceeding 71 bits)
  if (binaryString[0] === '1' || binaryString.length > 77) {
    return { "error": "Error: First digit of 18-character hex string telemetry data must fall in the range 0 to 7." };
  }

  //console.log('telemetry', binaryString);
  // Convert binary string back to hex string
  return { "result": binaryToHex(binaryString) };
}

// Decode 71-bit telemetry data (untested; done by ft8_lib already)
function decodeFT8Telemetry(payload) {
  if (!(payload instanceof Uint8Array) || payload.length !== 10) {
    throw new Error("Invalid payload: must be a Uint8Array of length 10");
  }

  // Extract the binary string
  let binaryString = '';
  for (let i = 0; i < 10; i++) {
    binaryString += payload[i].toString(2).padStart(8, '0');
  }

  // Remove the last 6 bits (message type)
  binaryString = binaryString.slice(0, -6);

  // Convert binary to hex
  const telemetryHex = binaryToHex(binaryString);

  return telemetryHex;
}


function packedToHexStr(packedData) {
    return `${Array.from(packedData).map(b => b.toString(16).padStart(2, '0')).join('')}`;
}

function packedToHexStrSp(packedData) {
    return `${Array.from(packedData).map(b => b.toString(16).padStart(2, '0')).join(' ')}`;
}

function binaryToHex(binaryStr) {
    // Pad the binary string to ensure its length is a multiple of 4
    let paddedBinaryStr = binaryStr.padEnd(Math.ceil(binaryStr.length / 4) * 4, '0');
    
    let hexString = '';
    for (let i = 0; i < paddedBinaryStr.length; i += 4) {
        let fourBits = paddedBinaryStr.slice(i, i + 4);
        let hexDigit = parseInt(fourBits, 2).toString(16);
        hexString += hexDigit;
    }
    
    return hexString;
}


// Helper function to convert hex string to binary string
function hexToBinary(hex) {
  return hex.split('').map(char => 
    parseInt(char, 16).toString(2).padStart(4, '0')
  ).join('');
}

// Helper function to convert binary string to hex string
function binaryToHex_V2(binary) {
  return binary.match(/.{1,8}/g).map(byte => 
    parseInt(byte, 2).toString(16).padStart(2, '0')
  ).join('');
}



