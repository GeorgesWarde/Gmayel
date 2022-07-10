using Microsoft.AspNetCore.Mvc.RazorPages;
using System.Data.SqlClient;

namespace clinicHealth.Pages.AdminPage
{
    public class IndexModel : PageModel
    {
        public List<Users> listUsers = new List<Users>();
        public void OnGet()
        {
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "Select * from users where role_id=2";//Select all doctors 
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        using (SqlDataReader reader = command.ExecuteReader())
                            while (reader.Read())
                            {
                                Users user = new Users();
                                user.id = reader.GetInt32(0);
                                user.full_name = reader.GetString(1);
                                user.username = reader.GetString(2);
                                user.age = reader.GetInt32(3);
                                user.Gender = reader.GetString(4);
                                listUsers.Add(user);
                            }
                    }
                }
            }
            catch (Exception ex)
            {

            }
        }
        public void OnPost()
        {
            String doctorName = Request.Form["doctorname"];
            try
            {
                String connectionString = "Data Source=.;Initial Catalog=Clinic;Integrated Security=True";
                using (SqlConnection connection = new SqlConnection(connectionString))
                {
                    connection.Open();
                    String doctorQuery = "Select * from users where role_id=2 and full_name LIKE @name";//Select all doctors 
                    using (SqlCommand command = new SqlCommand(doctorQuery, connection))
                    {
                        command.Parameters.AddWithValue("@name", doctorName);
                        using (SqlDataReader reader = command.ExecuteReader())
                            while (reader.Read())
                            {
                                listUsers.Clear();
                                Users user = new Users();
                                user.id = reader.GetInt32(0);
                                user.full_name = reader.GetString(1);
                                user.username = reader.GetString(2);
                                user.age = reader.GetInt32(3);
                                user.Gender = reader.GetString(4);
                                listUsers.Add(user);
                            }
                    }
                }
            }
            catch (Exception ex)
            {

            }
        }

    }
    public class Users
    {
        public int id;
        public String full_name;
        public String username;
        public int age;
        public String Gender;
        public int role_id;
        public String password;

    }
}
