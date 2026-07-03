import unittest

from app import find_user
from db import FakeDb


class SqlTest(unittest.TestCase):
    def test_uses_parameterized_query(self):
        db = FakeDb()
        find_user(db, "42")
        self.assertEqual(db.last_query, "SELECT * FROM users WHERE id = ?")
        self.assertEqual(db.last_params, ("42",))


if __name__ == "__main__":
    unittest.main()
