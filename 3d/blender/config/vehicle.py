"""Vehicle hard points (vehicle/glTF space: x = left, y = up, z = front; metres).

Starting set from docs/3d/PLAN.md §1. The packaging check (explode.py --check) is the arbiter;
changes are recorded in docs/3d/BUILD-NOTES.md.
"""

LENGTH = 4.280
WIDTH = 1.790
HEIGHT = 1.450
WHEELBASE = 2.620
TRACK_F = 1.540
TRACK_R = 1.510
Z_FRONT_AXLE = WHEELBASE / 2  # +1.31
Z_REAR_AXLE = -WHEELBASE / 2  # -1.31
Z_FRONT = 2.190
Z_REAR = -2.090

# wheels / tyres 205/55 R16, 6.5J ET46
TYRE_W = 0.205
TYRE_R = (16 * 0.0254 + 2 * 0.55 * 0.205) / 2  # 0.31595
WHEEL_Y = 0.316
RIM_R = 16 * 0.0254 / 2  # 0.2032 bead seat radius
RIM_W = 6.5 * 0.0254  # 0.1651
ET = 0.046
X_WHEEL_F = TRACK_F / 2  # 0.770
X_WHEEL_R = TRACK_R / 2  # 0.755
X_HUB_F = X_WHEEL_F + ET  # 0.816 hub face
X_HUB_R = X_WHEEL_R + ET
ARCH_R = 0.370

# brakes
DISC_F_R = 0.144
DISC_F_T = 0.025
DISC_R_R = 0.136
DISC_R_T = 0.010

# body key heights
Y_SILL = 0.17
Y_BELT = 0.98
Y_ROOF = 1.45

# shut lines (z)
Z_DOOR_FRONT = 0.80
Z_B_PILLAR = -0.18
Z_DOOR_REAR_END = -1.02
Z_BUMPER_F_JOIN = 1.92
Z_BUMPER_R_JOIN = -1.80

# engine
CRANK_Y = 0.43
CRANK_Z = 1.46
BLOCK_X0 = -0.40
BLOCK_X1 = 0.06
ENGINE_TILT = 12.0  # degrees toward the firewall (top toward -z)
CYL_X = (-0.038, -0.126, -0.214, -0.302)
TIMING_X = -0.43
ACC_X = -0.47

# steering / suspension
RACK_Y = 0.33
RACK_Z = 1.16
STRUT_BOTTOM = (0.66, 0.48, 1.30)
STRUT_TOP = (0.57, 0.88, 1.25)
KNUCKLE = (0.68, 0.32, 1.31)

# cooling pack
Z_IC = 2.07
Z_CONDENSER = 2.01
Z_RADIATOR = 1.95
Z_FAN = 1.87

# rear axle
BEAM = (0.0, 0.28, -1.18)
