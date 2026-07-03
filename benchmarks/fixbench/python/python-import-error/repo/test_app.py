import unittest

from app import normalize_name


class AppTest(unittest.TestCase):
    def test_normalize_name(self):
        self.assertEqual(normalize_name(" Ada "), "ada")


if __name__ == "__main__":
    unittest.main()
